import type {
  CampaignState,
  CostLedger,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import type { ImageModelCapability } from '@/domain/entities/model-capabilities';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type {
  AssetStoragePort,
  ImageGenPort,
  ImageGenOutput,
  VisionQaOutput,
  VisionQaPort,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  appendCostEntry,
  assertWithinBudget,
} from '../services/budget-guardrail';
import { validateImageRequest } from '../services/capability-validator';
import {
  ESTIMATED_VISION_QA_USD,
  MAX_VISION_QA_RETRIES,
  MIN_FIDELITY_SCORE,
  SHOT_COUNT,
} from '../services/media-constants';
import { requireImageModel } from '../services/model-resolver';

export interface GenerateKeyframesInput {
  campaign: CampaignState;
  imageModel: string;
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
  prompt: string;
  phase: 'initial' | 'retry';
  ledger: CostLedger;
}

interface AttemptOutput {
  keyframeUrl: string;
  qa: VisionQaOutput;
  ledger: CostLedger;
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

function fallbackRefinedPrompt(prompt: string): string {
  return `${prompt}, razor sharp product typography and exact label preservation`;
}

/**
 * Generates the three keyframes in order, runs Vision QA on each one, and
 * self-heals low-fidelity frames with exactly one retry when allowed.
 */
export class GenerateKeyframesWithQaUseCase {
  constructor(private readonly dependencies: GenerateKeyframesDependencies) {}

  async execute(
    input: GenerateKeyframesInput,
  ): Promise<GenerateKeyframesOutput> {
    const { campaign } = input;

    if (campaign.shots.length !== SHOT_COUNT) {
      throw new InvalidWorkflowStateError(
        `Keyframe generation requires exactly ${SHOT_COUNT} planned shots, received ${campaign.shots.length}.`,
      );
    }

    const imageModel = requireImageModel(
      this.dependencies.catalog,
      input.imageModel,
    );

    validateImageRequest({
      model: imageModel,
      aspectRatio: campaign.aspectRatio,
      referenceCount: campaign.product.imageUrl ? 1 : 0,
    });

    const allowedRetries = clampRetries(input.maxRetries);
    const orderedShots = [...campaign.shots].sort(
      (left, right) => left.index - right.index,
    );

    let ledger = campaign.ledger;
    const results: ShotResult[] = [];

    for (const shot of orderedShots) {
      const initialAttempt = await this.runAttempt({
        campaign,
        shot,
        imageModel,
        prompt: shot.imagePrompt,
        phase: 'initial',
        ledger,
      });

      ledger = initialAttempt.ledger;
      let qa = initialAttempt.qa;
      let keyframeUrl = initialAttempt.keyframeUrl;
      let wasRetried = false;

      if (qa.fidelityScore < MIN_FIDELITY_SCORE && allowedRetries > 0) {
        const refinedPrompt =
          qa.refinedPrompt.trim() !== ''
            ? qa.refinedPrompt
            : fallbackRefinedPrompt(shot.imagePrompt);

        const retryAttempt = await this.runAttempt({
          campaign,
          shot,
          imageModel,
          prompt: refinedPrompt,
          phase: 'retry',
          ledger,
        });

        ledger = retryAttempt.ledger;
        qa = retryAttempt.qa;
        keyframeUrl = retryAttempt.keyframeUrl;
        wasRetried = true;
      }

      results.push({
        shotIndex: shot.index,
        keyframeUrl,
        fidelityScore: qa.fidelityScore,
        qaFeedback: formatQaFeedback(qa, wasRetried),
        wasRetried,
        videoStatus: 'idle',
        videoProgress: 0,
      });
    }

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
    prompt,
    phase,
    ledger,
  }: AttemptParams): Promise<AttemptOutput> {
    assertWithinBudget(ledger, imageModel.estimatedCostPerImageUsd);

    const imageOutput = await this.dependencies.image.generateKeyframe({
      prompt,
      referenceImageUrls: [campaign.product.imageUrl],
      aspectRatio: campaign.aspectRatio,
      model: imageModel.id,
    });

    const keyframeUrl = await this.resolveKeyframeUrl(
      imageOutput,
      campaign.id,
      shot.index,
      phase,
    );

    let nextLedger = appendCostEntry(ledger, {
      step: 'image',
      model: imageOutput.model,
      costUsd: imageOutput.costUsd,
      note: `Shot ${shot.index} keyframe (${phase})`,
    });
    assertWithinBudget(nextLedger, 0);

    assertWithinBudget(nextLedger, ESTIMATED_VISION_QA_USD);
    const qa = await this.dependencies.visionQa.evaluateProductFidelity({
      originalProductUrl: campaign.product.imageUrl,
      generatedKeyframeUrl: keyframeUrl,
      originalPrompt: prompt,
      productDna: campaign.productDna,
    });

    nextLedger = appendCostEntry(nextLedger, {
      step: 'vision-qa',
      model: qa.model,
      costUsd: qa.costUsd,
      note: `Shot ${shot.index} product fidelity check (${phase})`,
    });
    assertWithinBudget(nextLedger, 0);

    return {
      keyframeUrl,
      qa,
      ledger: nextLedger,
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
      const filename = `${safeCampaignId}-shot-${shotIndex}-${phase}.jpeg`;
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
