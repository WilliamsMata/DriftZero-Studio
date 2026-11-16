import type {
  CampaignState,
  CostLedger,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import {
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
} from '@/domain/entities/shot-sequence';
import type {
  ChatModelCapability,
  ImageModelCapability,
} from '@/domain/entities/model-capabilities';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type {
  AssetStoragePort,
  ImageGenOutput,
  ImageGenPort,
  VisionQaOutput,
  VisionQaPort,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  appendCostEntry,
  assertWithinBudget,
  roundUsd,
} from '../services/budget-guardrail';
import { validateImageRequest } from '../services/capability-validator';
import { estimateVisionQaCostUsd } from '../services/chat-cost-estimator';
import { mapWithConcurrency } from '../services/concurrency';
import { buildKeyframePrompt } from '../services/keyframe-prompt';
import {
  MAX_VISION_QA_RETRIES,
  MEDIA_CONCURRENCY,
  MIN_FIDELITY_SCORE,
} from '../services/media-constants';
import {
  requireImageModel,
  requireVisionModel,
} from '../services/model-resolver';

export interface GenerateKeyframesInput {
  campaign: CampaignState;
  imageModel: string;
  visionModel: string;
  maxRetries?: number;
}

export interface GenerateKeyframesOutput {
  campaign: CampaignState;
  results: ShotResult[];
  ledger: CostLedger;
}

export interface GenerateKeyframesDependencies {
  image: ImageGenPort;
  visionQa: VisionQaPort;
  storage: AssetStoragePort;
  catalog: ModelCatalogPort;
}

interface AttemptParams {
  campaign: CampaignState;
  shot: ShotPlan;
  imageModel: ImageModelCapability;
  visionModel: ChatModelCapability;
  /** Scene and camera direction, before product identity is injected. */
  creativeDirection: string;
  /** Extra instruction for the single Vision QA repair attempt. */
  correctiveFeedback?: string;
  phase: 'initial' | 'retry';
}

interface AttemptResult {
  shot: ShotPlan;
  phase: 'initial' | 'retry';
  creativeDirection: string;
  /** Exact prompt sent to the image model, including identity rules. */
  prompt: string;
  image: ImageGenOutput;
  qa: VisionQaOutput;
  keyframeUrl: string;
}

function clampRetries(requestedRetries: number | undefined): number {
  if (requestedRetries === undefined) return MAX_VISION_QA_RETRIES;
  return Math.min(
    Math.max(Math.trunc(requestedRetries), 0),
    MAX_VISION_QA_RETRIES,
  );
}

function formatQaFeedback(qa: VisionQaOutput, wasRetried: boolean): string {
  const defects =
    qa.defects.length > 0
      ? qa.defects.join('; ')
      : 'No label or geometry defects detected.';

  if (!wasRetried) {
    return `${qa.fidelityScore}/10 product fidelity. ${defects}`;
  }

  if (qa.fidelityScore >= MIN_FIDELITY_SCORE) {
    return `Self-healed after one auto-retry. ${qa.fidelityScore}/10 product fidelity. ${defects}`;
  }

  return `Auto-retry applied, but fidelity remains below ${MIN_FIDELITY_SCORE}/10. ${qa.fidelityScore}/10 product fidelity. ${defects}`;
}

function formatQaCorrections(qa: VisionQaOutput): string {
  if (qa.defects.length === 0) {
    return 'The previous keyframe drifted from the reference. Match the product exactly.';
  }

  return `Eliminate these defects from the previous keyframe: ${qa.defects.join(
    '; ',
  )}.`;
}

function appendAttemptCosts(
  ledger: CostLedger,
  attempts: readonly AttemptResult[],
): CostLedger {
  let next = ledger;

  for (const attempt of attempts) {
    next = appendCostEntry(next, {
      step: 'image',
      model: attempt.image.model,
      costUsd: attempt.image.costUsd,
      note: `Shot ${attempt.shot.index} keyframe (${attempt.phase})`,
    });
    next = appendCostEntry(next, {
      step: 'vision-qa',
      model: attempt.qa.model,
      costUsd: attempt.qa.costUsd,
      note: `Shot ${attempt.shot.index} product fidelity check (${attempt.phase})`,
    });
  }

  return next;
}

/**
 * Generates every keyframe and runs Vision QA per shot.
 *
 * Shots are processed in parallel with a bounded concurrency so a five-shot
 * campaign does not serialize five image generations. Budget batches are
 * preflighted before each wave, and the one-repair rule still applies per shot.
 */
export class GenerateKeyframesWithQaUseCase {
  constructor(private readonly dependencies: GenerateKeyframesDependencies) {}

  async execute(
    input: GenerateKeyframesInput,
  ): Promise<GenerateKeyframesOutput> {
    const { campaign } = input;

    if (
      campaign.shots.length < MIN_SHOT_COUNT ||
      campaign.shots.length > MAX_SHOT_COUNT
    ) {
      throw new InvalidWorkflowStateError(
        `Keyframe generation supports between ${MIN_SHOT_COUNT} and ${MAX_SHOT_COUNT} planned shots, received ${campaign.shots.length}.`,
      );
    }

    if (campaign.results.length !== campaign.shots.length) {
      throw new InvalidWorkflowStateError(
        'Keyframe generation requires one result placeholder per planned shot.',
      );
    }

    const imageModel = requireImageModel(
      this.dependencies.catalog,
      input.imageModel,
    );
    const visionModel = requireVisionModel(
      this.dependencies.catalog,
      input.visionModel,
    );
    const estimatedVisionQaUsd = estimateVisionQaCostUsd(visionModel);

    validateImageRequest({
      model: imageModel,
      aspectRatio: campaign.aspectRatio,
      referenceCount: campaign.product.imageUrl ? 1 : 0,
    });

    const allowedRetries = clampRetries(input.maxRetries);
    const orderedShots = [...campaign.shots].sort(
      (left, right) => left.index - right.index,
    );

    orderedShots.forEach((shot, position) => {
      if (shot.index !== position + 1) {
        throw new InvalidWorkflowStateError(
          'Campaign shots must use sequential indexes starting at 1.',
        );
      }
    });

    const estimatedBatchUsd = roundUsd(
      (imageModel.estimatedCostPerImageUsd + estimatedVisionQaUsd) *
        orderedShots.length,
    );
    assertWithinBudget(campaign.ledger, estimatedBatchUsd);

    const initialAttempts = await mapWithConcurrency(
      orderedShots,
      MEDIA_CONCURRENCY,
      (shot) =>
        this.runAttempt({
          campaign,
          shot,
          imageModel,
          visionModel,
          creativeDirection: shot.imagePrompt,
          phase: 'initial',
        }),
    );

    let ledger = appendAttemptCosts(campaign.ledger, initialAttempts);
    assertWithinBudget(ledger, 0);

    const retryCandidates = initialAttempts.filter(
      (attempt) => attempt.qa.fidelityScore < MIN_FIDELITY_SCORE,
    );
    let retryAttempts: AttemptResult[] = [];

    if (allowedRetries > 0 && retryCandidates.length > 0) {
      const estimatedRetryBatchUsd = roundUsd(
        (imageModel.estimatedCostPerImageUsd + estimatedVisionQaUsd) *
          retryCandidates.length,
      );
      assertWithinBudget(ledger, estimatedRetryBatchUsd);

      retryAttempts = await mapWithConcurrency(
        retryCandidates,
        MEDIA_CONCURRENCY,
        (attempt) => {
          const refinedDirection = attempt.qa.refinedPrompt.trim();
          const creativeDirection =
            refinedDirection !== ''
              ? refinedDirection
              : attempt.creativeDirection;

          return this.runAttempt({
            campaign,
            shot: attempt.shot,
            imageModel,
            visionModel,
            creativeDirection,
            correctiveFeedback: formatQaCorrections(attempt.qa),
            phase: 'retry',
          });
        },
      );

      ledger = appendAttemptCosts(ledger, retryAttempts);
      assertWithinBudget(ledger, 0);
    }

    const initialByIndex = new Map(
      initialAttempts.map((attempt) => [attempt.shot.index, attempt]),
    );
    const retryByIndex = new Map(
      retryAttempts.map((attempt) => [attempt.shot.index, attempt]),
    );

    const results: ShotResult[] = orderedShots.map((shot) => {
      const initial = initialByIndex.get(shot.index);

      if (!initial) {
        throw new InvalidWorkflowStateError(
          `Shot ${shot.index} is missing its keyframe result.`,
        );
      }

      const retry = retryByIndex.get(shot.index);
      const finalAttempt = retry ?? initial;
      const wasRetried = retry !== undefined;

      return {
        shotIndex: shot.index,
        keyframeUrl: finalAttempt.keyframeUrl,
        fidelityScore: finalAttempt.qa.fidelityScore,
        qaFeedback: formatQaFeedback(finalAttempt.qa, wasRetried),
        wasRetried,
        imagePromptUsed: finalAttempt.prompt,
        videoStatus: 'idle',
        videoProgress: 0,
      };
    });

    const updatedCampaign: CampaignState = {
      ...campaign,
      results,
      ledger,
    };

    return {
      campaign: updatedCampaign,
      results,
      ledger,
    };
  }

  private async runAttempt({
    campaign,
    shot,
    imageModel,
    visionModel,
    creativeDirection,
    correctiveFeedback,
    phase,
  }: AttemptParams): Promise<AttemptResult> {
    // Compose at the generation boundary so every path (planned campaign,
    // preset, or API caller) sends the same identity-locked prompt.
    const prompt = buildKeyframePrompt({
      creativeDirection,
      productDna: campaign.productDna,
      tone: campaign.tone,
      aspectRatio: campaign.aspectRatio,
      correctiveFeedback,
    });

    const image = await this.dependencies.image.generateKeyframe({
      prompt,
      referenceImageUrls: [campaign.product.imageUrl],
      aspectRatio: campaign.aspectRatio,
      model: imageModel.id,
    });

    const keyframeUrl = await this.resolveKeyframeUrl(
      image,
      campaign.id,
      shot.index,
      phase,
    );

    // QA receives the creative direction, not the composed prompt: its
    // `refinedPrompt` replaces the scene direction and the application
    // re-applies the identity lock on the retry.
    const qa = await this.dependencies.visionQa.evaluateProductFidelity({
      originalProductUrl: campaign.product.imageUrl,
      generatedKeyframeUrl: keyframeUrl,
      originalPrompt: creativeDirection,
      productDna: campaign.productDna,
      model: visionModel.id,
    });

    return {
      shot,
      phase,
      creativeDirection,
      prompt,
      image,
      qa,
      keyframeUrl,
    };
  }

  private async resolveKeyframeUrl(
    output: ImageGenOutput,
    campaignId: string,
    shotIndex: ShotPlan['index'],
    phase: 'initial' | 'retry',
  ): Promise<string> {
    if (output.publicUrl) return output.publicUrl;

    if (output.b64Json) {
      const safeCampaignId = campaignId.replace(/[^a-zA-Z0-9_-]/g, '-');
      const filename = `${safeCampaignId}-shot-${shotIndex}-${phase}.png`;
      return this.dependencies.storage.savePublicImageFromBase64(
        output.b64Json,
        filename,
      );
    }

    throw new InvalidWorkflowStateError(
      `Image provider returned neither a public URL nor base64 data for shot ${shotIndex}.`,
    );
  }
}
