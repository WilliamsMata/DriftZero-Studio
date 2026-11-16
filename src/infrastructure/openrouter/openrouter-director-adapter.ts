import { z } from 'zod';
import { BRAND_TONE_DIRECTION } from '@/application/services/brand-direction';
import {
  requireChatModel,
  requireVisionModel,
} from '@/application/services/model-resolver';
import type { ShotPlan } from '@/domain/entities/campaign';
import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import {
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
  shotRoleForIndex,
} from '@/domain/entities/shot-sequence';
import { ProviderRequestError } from '@/domain/errors/domain-errors';
import type {
  BriefDraftOutput,
  CreativeDirectorPort,
  DirectorOutput,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { modelCatalog } from './model-catalog';
import {
  OpenRouterClient,
  describeEmptyChatCompletion,
  estimateChatUsageCostUsd,
  extractJsonObject,
  resolveLocalAssetToDataUri,
  type OpenRouterUsage,
} from './openrouter-client';

/** Conservative ledger value used only when OpenRouter omits usage data. */
const FALLBACK_DIRECTOR_COST_USD = 0.01;
const FALLBACK_BRIEF_COST_USD = 0.002;
const MAX_BRIEF_LENGTH = 500;

const directorShotSchema = z.object({
  index: z.number().int().min(MIN_SHOT_COUNT).max(MAX_SHOT_COUNT),
  role: z.enum(['hero-packshot', 'lifestyle-context', 'macro-finale']),
  title: z.string().trim().min(3).max(160),
  imagePrompt: z.string().trim().min(20).max(2000),
  videoMotionPrompt: z.string().trim().min(10).max(1000),
});

const directorOutputSchema = z.object({
  productDna: z.string().trim().min(20).max(3000),
  adCopy: z.object({
    hook: z.string().trim().min(3).max(240),
    headline: z.string().trim().min(3).max(240),
    cta: z.string().trim().min(2).max(120),
  }),
  shots: z
    .array(directorShotSchema)
    .min(MIN_SHOT_COUNT)
    .max(MAX_SHOT_COUNT),
});

const briefDraftSchema = z.object({
  brief: z.string().trim().min(20).max(4_000),
});

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      cost: z.number().nonnegative().optional(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  model: z.string().optional(),
});

function buildSystemPrompt(shotCount: number): string {
  const shotLines = Array.from({ length: shotCount }, (_, position) => {
    const index = position + 1;
    const role = shotRoleForIndex(index, shotCount);
    return `    { "index": ${index}, "role": "${role}", "title": "...", "imagePrompt": "...", "videoMotionPrompt": "..." }`;
  }).join(',\n');

  const roles = Array.from({ length: shotCount }, (_, position) =>
    shotRoleForIndex(position + 1, shotCount),
  );

  return `You are the creative director of DriftZero Studio, a product-faithful advertising studio.
Plan a ${shotCount}-shot vertical/social commercial for the product shown in the attached PRODUCT ANCHOR image.

The PRODUCT ANCHOR image is the only source of truth for the product. Analyze it before writing anything. Never invent or alter the product's silhouette, proportions, materials, colors, logo, typography, or label text. If a label detail is illegible, write "unreadable" instead of guessing.

Return ONLY a single JSON object with this exact shape:
{
  "productDna": "Dense visual identity string transcribed from the anchor image: silhouette, proportions, materials, colors, finish, logo placement, exact label text and typography, and signature details.",
  "adCopy": { "hook": "short hook", "headline": "short headline", "cta": "short CTA" },
  "shots": [
${shotLines}
  ]
}

Rules:
- Exactly ${shotCount} shot${shotCount === 1 ? '' : 's'}.
- Use exactly these roles in this order: ${roles.join(', ')}.
- productDna must be grounded in the anchor image. Quote visible label text verbatim; do not invent copy.
- Each imagePrompt must describe a still keyframe: product placement, set/environment, camera and lens, framing, lighting, palette, materials, and mood.
- Each imagePrompt must explicitly require the exact product from the reference image and preserve its identity. The scene must adapt to the product, never the reverse.
- Each imagePrompt must not request text overlays, captions, watermarks, or invented logos. Only the product's own label text may appear.
- Each videoMotionPrompt must describe camera motion only: no new objects, no text changes, and no product morphing, warping, recoloring, or relabeling.
- Do not include Markdown fences, commentary, or extra keys.`;
}

function buildBriefSystemPrompt(): string {
  return `You are a senior creative strategist at DriftZero Studio, a product-faithful advertising studio.
Write the campaign brief for a short social commercial.

Rules:
- 1 or 2 sentences, at most 480 characters.
- Cover: the launch moment or occasion, the audience or emotional promise, the narrative setting, and one or two must-hit product beats.
- Use only the supplied product name, category, tone, aspect ratio, and shot count. Never invent label text, materials, flavors, features, or claims.
- Keep it concrete and visual, suitable for a creative director to turn into a storyboard.
- No emojis, hashtags, quotation marks, markdown, or calls to action.
- Return ONLY a JSON object with this exact shape: { "brief": "the campaign brief" }`;
}

function clampBrief(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_BRIEF_LENGTH) return trimmed;

  const window = trimmed.slice(0, MAX_BRIEF_LENGTH);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );

  if (sentenceEnd >= 200) {
    return window.slice(0, sentenceEnd + 1).trim();
  }

  const lastSpace = window.lastIndexOf(' ');
  return (lastSpace >= 200 ? window.slice(0, lastSpace) : window).trim();
}

function resolveCostUsd(
  usage: OpenRouterUsage | undefined,
  model: ChatModelCapability | undefined,
  fallbackUsd = FALLBACK_DIRECTOR_COST_USD,
): number {
  if (usage?.cost !== undefined && Number.isFinite(usage.cost)) {
    return usage.cost;
  }

  const estimate = estimateChatUsageCostUsd(usage, model);
  return estimate > 0 ? estimate : fallbackUsd;
}

function validateShotSequence(
  shots: readonly ShotPlan[],
  shotCount: number,
): void {
  if (shots.length !== shotCount) {
    throw new ProviderRequestError({
      provider: 'OpenRouter',
      status: 200,
      providerMessage: `the creative director returned ${shots.length} shots instead of ${shotCount}.`,
    });
  }

  shots.forEach((shot, position) => {
    const expectedIndex = position + 1;
    const expectedRole = shotRoleForIndex(expectedIndex, shotCount);

    if (shot.index !== expectedIndex || shot.role !== expectedRole) {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 200,
        providerMessage: `shot ${expectedIndex} must use index ${expectedIndex} and role "${expectedRole}".`,
      });
    }
  });
}

export class OpenRouterDirectorAdapter implements CreativeDirectorPort {
  private readonly client: OpenRouterClient;
  private readonly catalog: ModelCatalogPort;

  constructor(
    options: { client?: OpenRouterClient; catalog?: ModelCatalogPort } = {},
  ) {
    this.client = options.client ?? new OpenRouterClient({ mode: 'live' });
    this.catalog = options.catalog ?? modelCatalog;
  }

  async planCampaign(
    input: Parameters<CreativeDirectorPort['planCampaign']>[0],
  ): Promise<DirectorOutput> {
    // The director must see the product anchor: without it, image prompts and
    // productDna are written from the product name alone and drift immediately.
    const model = requireVisionModel(
      this.catalog,
      input.model,
      'creative direction',
    );
    const productAnchorUrl = await resolveLocalAssetToDataUri(
      input.product.imageUrl,
    );
    const userPrompt = [
      'The attached image is the PRODUCT ANCHOR and the ground truth for the product.',
      `Product name: ${input.product.name}`,
      `Category: ${input.product.category}`,
      `Aspect ratio: ${input.aspectRatio}`,
      `Shot count: ${input.shotCount}`,
      `Brand tone: ${input.tone}`,
      `Tone direction: ${BRAND_TONE_DIRECTION[input.tone]}`,
      input.userGoal !== undefined && input.userGoal.trim() !== ''
        ? `Campaign goal: ${input.userGoal.trim()}`
        : 'Campaign goal: launch a premium social ad with zero product drift.',
      'If the product name or category conflicts with the anchor image, the image wins. Analyze the anchor first, then plan the campaign.',
    ].join('\n');

    const rawResponse = await this.client.requestJson<unknown>(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(input.shotCount) },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: { url: productAnchorUrl },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          usage: { include: true },
          // Deterministic enough to keep the same product identity across
          // repeated runs, while still leaving room for creative framing.
          temperature: 0.4,
          // Effort is per model: Muse Ember is configured as `high` because it
          // degrades badly at `low`. No max_tokens cap: the model decides how
          // much it needs to think, avoiding truncated JSON blueprints.
          reasoning: { effort: model.reasoningEffort ?? 'low' },
        }),
      },
      60_000,
    );

    const response = chatCompletionSchema.parse(rawResponse);
    const choice = response.choices[0];
    const content = choice?.message.content;

    if (content === null || content === undefined || content.trim() === '') {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 200,
        providerMessage: describeEmptyChatCompletion('creative director', {
          finishReason: choice?.finish_reason,
          reasoningTokens:
            response.usage?.completion_tokens_details?.reasoning_tokens,
        }),
      });
    }

    const parsed = directorOutputSchema.parse(extractJsonObject(content));
    validateShotSequence(parsed.shots, input.shotCount);

    const shots: ShotPlan[] = parsed.shots;

    return {
      productDna: parsed.productDna,
      adCopy: parsed.adCopy,
      shots,
      costUsd: resolveCostUsd(response.usage, model),
      model: response.model ?? input.model,
    };
  }

  async draftBrief(
    input: Parameters<CreativeDirectorPort['draftBrief']>[0],
  ): Promise<BriefDraftOutput> {
    // A brief is campaign intent, not product DNA: text-only keeps it cheap and
    // fast while the anchor image remains the only identity reference.
    const model = requireChatModel(this.catalog, input.model);
    const userPrompt = [
      `Product name: ${input.product.name}`,
      `Category: ${input.product.category}`,
      `Brand tone: ${input.tone}`,
      `Tone direction: ${BRAND_TONE_DIRECTION[input.tone]}`,
      `Aspect ratio: ${input.aspectRatio}`,
      `Shot count: ${input.shotCount}`,
    ].join('\n');

    const rawResponse = await this.client.requestJson<unknown>(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: 'system', content: buildBriefSystemPrompt() },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          usage: { include: true },
          temperature: 0.7,
          reasoning: { effort: model.reasoningEffort ?? 'low' },
        }),
      },
      30_000,
    );

    const response = chatCompletionSchema.parse(rawResponse);
    const choice = response.choices[0];
    const content = choice?.message.content;

    if (content === null || content === undefined || content.trim() === '') {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 200,
        providerMessage: describeEmptyChatCompletion('creative brief', {
          finishReason: choice?.finish_reason,
          reasoningTokens:
            response.usage?.completion_tokens_details?.reasoning_tokens,
        }),
      });
    }

    const parsed = briefDraftSchema.parse(extractJsonObject(content));

    return {
      brief: clampBrief(parsed.brief),
      costUsd: resolveCostUsd(
        response.usage,
        model,
        FALLBACK_BRIEF_COST_USD,
      ),
      model: response.model ?? model.id,
    };
  }
}
