import type {
  CampaignState,
  CostLedger,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import type { VideoDurationSeconds } from '@/domain/entities/model-capabilities';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type { VideoGenPort } from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  appendCostEntry,
  assertWithinBudget,
  roundUsd,
} from '../services/budget-guardrail';
import { validateVideoRequest } from '../services/capability-validator';
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  SHOT_COUNT,
} from '../services/media-constants';
import { requireVideoModel } from '../services/model-resolver';

export interface SubmitVideosInput {
  campaign: CampaignState;
  videoModel: string;
  durationSeconds?: VideoDurationSeconds;
}

export interface SubmitVideosOutput {
  campaign: CampaignState;
  results: ShotResult[];
  ledger: CostLedger;
}

export interface SubmitVideosDependencies {
  video: VideoGenPort;
  catalog: ModelCatalogPort;
}

function indexShots(shots: readonly ShotPlan[]): Map<number, ShotPlan> {
  return new Map(shots.map((shot) => [shot.index, shot]));
}

function indexResults(results: readonly ShotResult[]): Map<number, ShotResult> {
  return new Map(results.map((result) => [result.shotIndex, result]));
}

/**
 * Submits one image-to-video job per keyframe. When the selected model supports
 * last-frame conditioning, shots 1 and 2 receive the next shot's keyframe so
 * the final edit cuts smoothly between scenes.
 */
export class SubmitVideosUseCase {
  constructor(private readonly dependencies: SubmitVideosDependencies) {}

  async execute(input: SubmitVideosInput): Promise<SubmitVideosOutput> {
    const { campaign } = input;

    if (
      campaign.shots.length !== SHOT_COUNT ||
      campaign.results.length !== SHOT_COUNT
    ) {
      throw new InvalidWorkflowStateError(
        `Video submission requires ${SHOT_COUNT} planned shots and ${SHOT_COUNT} keyframe results.`,
      );
    }

    const videoModel = requireVideoModel(
      this.dependencies.catalog,
      input.videoModel,
    );
    const durationSeconds =
      input.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS;

    const shotByIndex = indexShots(campaign.shots);
    const resultByIndex = indexResults(campaign.results);
    const shotIndexes: ShotPlan['index'][] = [1, 2, 3];

    for (const shotIndex of shotIndexes) {
      const result = resultByIndex.get(shotIndex);
      if (!result || !result.keyframeUrl) {
        throw new InvalidWorkflowStateError(
          `Shot ${shotIndex} is missing a generated keyframe URL.`,
        );
      }
      if (!shotByIndex.has(shotIndex)) {
        throw new InvalidWorkflowStateError(
          `Shot ${shotIndex} is missing from the campaign plan.`,
        );
      }
    }

    const estimatedPerShotUsd = roundUsd(
      videoModel.estimatedCostPerSecondUsd * durationSeconds,
    );

    // Fail before spending anything if the full three-shot batch would break
    // the campaign budget.
    assertWithinBudget(
      campaign.ledger,
      roundUsd(estimatedPerShotUsd * SHOT_COUNT),
    );

    let ledger = campaign.ledger;
    const results: ShotResult[] = [];

    for (const shotIndex of shotIndexes) {
      const shot = shotByIndex.get(shotIndex);
      const result = resultByIndex.get(shotIndex);

      if (!shot || !result) {
        throw new InvalidWorkflowStateError(
          `Shot ${shotIndex} could not be resolved for video submission.`,
        );
      }

      const nextResult =
        shotIndex < SHOT_COUNT ? resultByIndex.get(shotIndex + 1) : undefined;
      const lastFrameUrl =
        videoModel.supportsLastFrame && nextResult
          ? nextResult.keyframeUrl
          : undefined;

      validateVideoRequest({
        model: videoModel,
        aspectRatio: campaign.aspectRatio,
        durationSeconds,
        hasLastFrame: Boolean(lastFrameUrl),
      });

      assertWithinBudget(ledger, estimatedPerShotUsd);

      const submission = await this.dependencies.video.submitImageToVideo({
        prompt: shot.videoMotionPrompt,
        firstFrameUrl: result.keyframeUrl,
        lastFrameUrl,
        aspectRatio: campaign.aspectRatio,
        durationSeconds,
        model: videoModel.id,
      });

      ledger = appendCostEntry(ledger, {
        step: 'video',
        model: submission.model,
        costUsd: submission.estimatedCostUsd,
        note: `Shot ${shotIndex} queued as ${submission.jobId} (estimated)`,
      });
      assertWithinBudget(ledger, 0);

      results.push({
        ...result,
        videoJobId: submission.jobId,
        videoStatus: 'queued',
        videoProgress: 0,
        videoPlaybackUrl: undefined,
      });
    }

    results.sort((left, right) => left.shotIndex - right.shotIndex);

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
}
