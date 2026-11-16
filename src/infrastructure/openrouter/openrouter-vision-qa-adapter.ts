import { z } from 'zod';
import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import { ProviderRequestError } from '@/domain/errors/domain-errors';
import type { VisionQaOutput, VisionQaPort } from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { modelCatalog } from './model-catalog';
import {
  OpenRouterClient,
  describeInvalidChatCompletion,
  estimateChatUsageCostUsd,
  extractJsonObject,
  resolveLocalAssetToDataUri,
  type ChatCompletionDiagnostics,
  type OpenRouterUsage,
} from './openrouter-client';

const FALLBACK_VISION_QA_COST_USD = 0.001;
const MAX_QA_PARSE_ATTEMPTS = 2;

const visionQaResultSchema = z.object({
  fidelityScore: z.number().min(1).max(10),
  defects: z.array(z.string().trim().min(1)).max(20),
  refinedPrompt: z.string(),
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
  provider: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a meticulous product-fidelity QA inspector for advertising keyframes.
Compare the original product anchor against the generated keyframe and report product drift.
Return ONLY a JSON object:
{
  "fidelityScore": 7,
  "defects": ["short defect description"],
  "refinedPrompt": "full replacement keyframe direction when the score is below 7, otherwise an empty string. Preserve the original scene, camera, lighting, and composition; change only what is needed to fix product drift."
}

Scoring:
- 1-2: different product or unusable geometry.
- 3-4: obvious shape, color, or logo/label drift.
- 5-6: recognizable but the label or silhouette is not publish-ready.
- 7-8: faithful with minor cosmetic imperfections.
- 9-10: indistinguishable from the anchor, pixel-clean label.

Check exact silhouette, proportions, material response, dominant colors, logo placement, and label legibility/verbatim text. Zero product drift is mandatory. Never invent label text, colors, or product details that are not visible in the original anchor.`;

function resolveCostUsd(
  usage: OpenRouterUsage | undefined,
  model: ChatModelCapability | undefined,
): number {
  if (usage?.cost !== undefined && Number.isFinite(usage.cost)) {
    return usage.cost;
  }

  const estimate = estimateChatUsageCostUsd(usage, model);
  return estimate > 0 ? estimate : FALLBACK_VISION_QA_COST_USD;
}

export class OpenRouterVisionQaAdapter implements VisionQaPort {
  private readonly client: OpenRouterClient;
  private readonly catalog: ModelCatalogPort;

  constructor(
    options: { client?: OpenRouterClient; catalog?: ModelCatalogPort } = {},
  ) {
    this.client = options.client ?? new OpenRouterClient({ mode: 'live' });
    this.catalog = options.catalog ?? modelCatalog;
  }

  async evaluateProductFidelity(
    input: Parameters<VisionQaPort['evaluateProductFidelity']>[0],
  ): Promise<VisionQaOutput> {
    const model = this.catalog.getChatModel(input.model);
    const [originalImageUrl, generatedImageUrl] = await Promise.all([
      resolveLocalAssetToDataUri(input.originalProductUrl),
      resolveLocalAssetToDataUri(input.generatedKeyframeUrl),
    ]);

    const instruction = [
      'First image: ORIGINAL PRODUCT ANCHOR (ground truth).',
      'Second image: GENERATED KEYFRAME under review.',
      `Product DNA: ${input.productDna}`,
      `Keyframe creative direction used: ${input.originalPrompt}`,
      'Score how faithfully the generated keyframe preserves the product. Then list concrete defects and, when the score is below 7, rewrite the keyframe creative direction to eliminate every defect without inventing product details.',
    ].join('\n');

    let totalCostUsd = 0;
    let lastDiagnostics: ChatCompletionDiagnostics = {};
    let lastParseError: unknown;

    for (let attempt = 0; attempt < MAX_QA_PARSE_ATTEMPTS; attempt += 1) {
      const isRetry = attempt > 0;
      const rawResponse = await this.client.requestJson<unknown>(
        '/chat/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            model: input.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'text', text: instruction },
                  {
                    type: 'image_url',
                    image_url: { url: originalImageUrl },
                  },
                  {
                    type: 'image_url',
                    image_url: { url: generatedImageUrl },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
            usage: { include: true },
            // A deterministic retry increases the chance of recovering from a
            // stochastic prose/truncated JSON response without regenerating
            // the keyframe (which costs ~60x more).
            temperature: isRetry ? 0 : 0.1,
            // Per-model effort; Muse Ember is configured as `high`. No
            // max_tokens cap so the QA JSON is never truncated mid-response.
            reasoning: { effort: model?.reasoningEffort ?? 'low' },
          }),
        },
        60_000,
      );

      const response = chatCompletionSchema.parse(rawResponse);
      const choice = response.choices[0];
      const content = choice?.message.content;
      const responseModel = response.model ?? input.model;

      totalCostUsd += resolveCostUsd(response.usage, model);
      lastDiagnostics = {
        finishReason: choice?.finish_reason,
        reasoningTokens:
          response.usage?.completion_tokens_details?.reasoning_tokens,
        contentPreview: content ?? undefined,
        provider: response.provider,
      };

      if (content === null || content === undefined || content.trim() === '') {
        lastParseError = new Error('the response content was empty');
        continue;
      }

      try {
        const parsed = visionQaResultSchema.parse(extractJsonObject(content));

        return {
          fidelityScore: parsed.fidelityScore,
          defects: parsed.defects,
          refinedPrompt: parsed.refinedPrompt.trim(),
          costUsd: totalCostUsd,
          model: responseModel,
        };
      } catch (error) {
        lastParseError = error;
      }
    }

    throw new ProviderRequestError({
      provider: 'OpenRouter',
      status: 200,
      providerMessage: describeInvalidChatCompletion(
        'vision QA model',
        {
          ...lastDiagnostics,
          parseError:
            lastParseError instanceof Error
              ? lastParseError.message
              : 'the response did not match the QA schema.',
        },
        MAX_QA_PARSE_ATTEMPTS,
      ),
    });
  }
}
