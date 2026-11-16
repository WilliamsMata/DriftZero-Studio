import type {
  AspectRatio,
  BrandTone,
  CampaignState,
  ExecutionMode,
  ProductAnchor,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import type { VideoDurationSeconds } from '@/domain/entities/model-capabilities';
import {
  DEFAULT_SHOT_COUNT,
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
} from '@/domain/entities/shot-sequence';
import {
  BudgetGuardrailError,
  InvalidWorkflowStateError,
} from '@/domain/errors/domain-errors';
import type { CreativeDirectorPort } from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  appendCostEntry,
  assertWithinBudget,
  createCostLedger,
  roundUsd,
} from '../services/budget-guardrail';
import { estimatePlanCostUsd } from '../services/chat-cost-estimator';
import {
  validateImageRequest,
  validateVideoRequest,
} from '../services/capability-validator';
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  HARD_MAX_CAMPAIGN_BUDGET_USD,
} from '../services/media-constants';
import {
  requireImageModel,
  requireVideoModel,
  requireVisionModel,
} from '../services/model-resolver';

export interface PlanCampaignInput {
  product: ProductAnchor;
  tone: BrandTone;
  aspectRatio: AspectRatio;
  textModel: string;
  imageModel: string;
  videoModel: string;
  shotCount?: number;
  durationSeconds?: VideoDurationSeconds;
  maxBudgetUsd: number;
  userGoal?: string;
  mode?: ExecutionMode;
  estimatedDirectorUsd?: number;
}

export interface PlanCampaignDependencies {
  director: CreativeDirectorPort;
  catalog: ModelCatalogPort;
}

function createInitialResults(shots: readonly ShotPlan[]): ShotResult[] {
  return shots.map(
    (shot): ShotResult => ({
      shotIndex: shot.index,
      keyframeUrl: '',
      fidelityScore: 0,
      qaFeedback: '',
      wasRetried: false,
      videoStatus: 'idle',
      videoProgress: 0,
    }),
  );
}

function createCampaignId(): string {
  const timestamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `campaign-${timestamp}-${suffix}`;
}

/**
 * Creates the campaign blueprint: validates the requested models against the
 * curated capability registry, reserves the director budget, and initializes
 * the immutable campaign state used by the rest of the pipeline.
 */
export class PlanCampaignUseCase {
  constructor(private readonly dependencies: PlanCampaignDependencies) {}

  async execute(input: PlanCampaignInput): Promise<CampaignState> {
    if (input.maxBudgetUsd > HARD_MAX_CAMPAIGN_BUDGET_USD) {
      throw new BudgetGuardrailError({
        currentUsd: 0,
        estimatedCostUsd: input.maxBudgetUsd,
        maxBudgetUsd: HARD_MAX_CAMPAIGN_BUDGET_USD,
      });
    }

    const shotCount = input.shotCount ?? DEFAULT_SHOT_COUNT;
    if (shotCount < MIN_SHOT_COUNT || shotCount > MAX_SHOT_COUNT) {
      throw new InvalidWorkflowStateError(
        `Campaign planning supports between ${MIN_SHOT_COUNT} and ${MAX_SHOT_COUNT} shots, received ${shotCount}.`,
      );
    }

    const textModel = requireVisionModel(
      this.dependencies.catalog,
      input.textModel,
      'creative direction',
    );
    const imageModel = requireImageModel(
      this.dependencies.catalog,
      input.imageModel,
    );
    const videoModel = requireVideoModel(
      this.dependencies.catalog,
      input.videoModel,
    );
    const durationSeconds =
      input.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS;

    validateImageRequest({
      model: imageModel,
      aspectRatio: input.aspectRatio,
      referenceCount: 1,
    });

    validateVideoRequest({
      model: videoModel,
      aspectRatio: input.aspectRatio,
      durationSeconds,
      hasLastFrame: false,
    });

    const estimatedDirectorUsd = roundUsd(
      input.estimatedDirectorUsd ?? estimatePlanCostUsd(textModel),
    );

    let ledger = createCostLedger(input.maxBudgetUsd);
    assertWithinBudget(ledger, estimatedDirectorUsd);

    const directorOutput = await this.dependencies.director.planCampaign({
      product: input.product,
      tone: input.tone,
      aspectRatio: input.aspectRatio,
      shotCount,
      userGoal: input.userGoal,
      model: textModel.id,
    });

    ledger = appendCostEntry(ledger, {
      step: 'director',
      model: directorOutput.model,
      costUsd: directorOutput.costUsd,
      note: `${shotCount}-shot campaign blueprint`,
    });

    // The live call is already spent at this point; fail fast before any media
    // generation if the actual director cost pushed the campaign over budget.
    assertWithinBudget(ledger, 0);

    return {
      id: createCampaignId(),
      mode: input.mode ?? 'mock',
      aspectRatio: input.aspectRatio,
      tone: input.tone,
      product: input.product,
      productDna: directorOutput.productDna,
      adCopy: directorOutput.adCopy,
      shots: [...directorOutput.shots],
      results: createInitialResults(directorOutput.shots),
      ledger,
    };
  }
}
