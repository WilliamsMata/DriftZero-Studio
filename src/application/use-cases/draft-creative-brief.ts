import type {
  AspectRatio,
  BrandTone,
  ProductAnchor,
} from '@/domain/entities/campaign';
import {
  DEFAULT_SHOT_COUNT,
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
} from '@/domain/entities/shot-sequence';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type {
  BriefDraftOutput,
  CreativeDirectorPort,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  assertWithinBudget,
  createCostLedger,
  roundUsd,
} from '../services/budget-guardrail';
import { estimateBriefCostUsd } from '../services/chat-cost-estimator';
import { requireChatModel } from '../services/model-resolver';

export interface DraftCreativeBriefInput {
  product: ProductAnchor;
  tone: BrandTone;
  aspectRatio: AspectRatio;
  briefModel: string;
  shotCount?: number;
  maxBudgetUsd: number;
}

export interface DraftCreativeBriefDependencies {
  director: CreativeDirectorPort;
  catalog: ModelCatalogPort;
}

export interface DraftCreativeBriefResult {
  brief: string;
  costUsd: number;
  model: string;
}

/**
 * Drafts the optional creative brief before planning.
 *
 * This is a text-only call, so unlike the director planning step it does not
 * require a vision-capable model. The brief only carries campaign intent
 * (occasion, audience, narrative, must-hit beats); product identity still comes
 * from the anchor image and the director prompt.
 */
export class DraftCreativeBriefUseCase {
  private readonly dependencies: DraftCreativeBriefDependencies;

  constructor(dependencies: DraftCreativeBriefDependencies) {
    this.dependencies = dependencies;
  }

  async execute(
    input: DraftCreativeBriefInput,
  ): Promise<DraftCreativeBriefResult> {
    const shotCount = input.shotCount;

    if (
      shotCount !== undefined &&
      (shotCount < MIN_SHOT_COUNT || shotCount > MAX_SHOT_COUNT)
    ) {
      throw new InvalidWorkflowStateError(
        `Creative brief drafting supports between ${MIN_SHOT_COUNT} and ${MAX_SHOT_COUNT} shots, received ${shotCount}.`,
      );
    }

    const model = requireChatModel(
      this.dependencies.catalog,
      input.briefModel,
    );

    // A brief is a tiny text call, but it is still billable: reserve it against
    // the same campaign cap before touching the provider.
    assertWithinBudget(
      createCostLedger(input.maxBudgetUsd),
      estimateBriefCostUsd(model),
    );

    const draft: BriefDraftOutput = await this.dependencies.director.draftBrief(
      {
        product: input.product,
        tone: input.tone,
        aspectRatio: input.aspectRatio,
        shotCount: shotCount ?? DEFAULT_SHOT_COUNT,
        model: model.id,
      },
    );

    const brief = draft.brief.trim();

    if (brief === '') {
      throw new InvalidWorkflowStateError(
        'The creative director returned an empty brief. Try drafting it again.',
      );
    }

    return {
      brief,
      costUsd: roundUsd(draft.costUsd),
      model: draft.model,
    };
  }
}
