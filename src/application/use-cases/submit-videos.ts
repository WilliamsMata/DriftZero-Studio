import type {
  CampaignState,
  CostLedger,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import type { VideoDurationSeconds } from '@/domain/entities/model-capabilities';
import {
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
} from '@/domain/entities/shot-sequence';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type {
  AssetStoragePort,
  VideoGenPort,
  VideoJobSubmission,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  appendCostEntry,
  assertWithinBudget,
  roundUsd,
} from '../services/budget-guardrail';
import { validateVideoRequest } from '../services/capability-validator';
import { mapWithConcurrency } from '../services/concurrency';
import { buildVideoMotionPrompt } from '../services/keyframe-prompt';
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  MEDIA_CONCURRENCY,
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
  storage: AssetStoragePort;
  catalog: ModelCatalogPort;
}

function indexShots(shots: readonly ShotPlan[]): Map<number, ShotPlan> {
  return new Map(shots.map((shot) => [shot.index, shot]));
}

function indexResults(results: readonly ShotResult[]): Map<number, ShotResult> {
  return new Map(results.map((result) => [result.shotIndex, result]));
}

function frameFileName(
  campaignId: string,
  shotIndex: ShotPlan['index'],
  position: 'first' | 'last',
  sourceUrl: string,
): string {
  const safeCampaignId = campaignId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const extension = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(sourceUrl)?.[1] ?? 'png';

  return `${safeCampaignId}-shot-${shotIndex}-${position}-frame.${extension.toLowerCase()}`;
}

interface SubmittedShot {
  shotIndex: number;
  submission: VideoJobSubmission;
}

/**
 * Submits one image-to-video job per keyframe in parallel with bounded
 * concurrency. When the selected model supports last-frame conditioning, each
 * shot receives the next shot's keyframe so the final edit cuts smoothly
 * between scenes.
 */
export class SubmitVideosUseCase {
  constructor(private readonly dependencies: SubmitVideosDependencies) {}

  async execute(input: SubmitVideosInput): Promise<SubmitVideosOutput> {
    const { campaign } = input;
    const shotCount = campaign.shots.length;

    if (shotCount < MIN_SHOT_COUNT || shotCount > MAX_SHOT_COUNT) {
      throw new InvalidWorkflowStateError(
        `Video submission supports between ${MIN_SHOT_COUNT} and ${MAX_SHOT_COUNT} planned shots, received ${shotCount}.`,
      );
    }

    if (campaign.results.length !== shotCount) {
      throw new InvalidWorkflowStateError(
        `Video submission requires ${shotCount} planned shots and ${shotCount} keyframe results.`,
      );
    }

    const videoModel = requireVideoModel(
      this.dependencies.catalog,
      input.videoModel,
    );
    const durationSeconds =
      input.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS;

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

    const shotByIndex = indexShots(orderedShots);
    const resultByIndex = indexResults(campaign.results);

    for (const shot of orderedShots) {
      const result = resultByIndex.get(shot.index);

      if (!result || !result.keyframeUrl) {
        throw new InvalidWorkflowStateError(
          `Shot ${shot.index} is missing a generated keyframe URL.`,
        );
      }
    }

    const nextResultByIndex = new Map<number, ShotResult>();
    orderedShots.forEach((shot, position) => {
      const nextShot = orderedShots[position + 1];
      const nextResult = nextShot
        ? resultByIndex.get(nextShot.index)
        : undefined;

      if (nextResult) {
        nextResultByIndex.set(shot.index, nextResult);
      }
    });

    const estimatedPerShotUsd = roundUsd(
      videoModel.estimatedCostPerSecondUsd * durationSeconds,
    );

    // Fail before spending anything if the full batch would break the cap.
    assertWithinBudget(
      campaign.ledger,
      roundUsd(estimatedPerShotUsd * shotCount),
    );

    const submitted = await mapWithConcurrency(
      orderedShots,
      MEDIA_CONCURRENCY,
      async (shot): Promise<SubmittedShot> => {
        const result = resultByIndex.get(shot.index);

        if (!result || !shotByIndex.has(shot.index)) {
          throw new InvalidWorkflowStateError(
            `Shot ${shot.index} could not be resolved for video submission.`,
          );
        }

        const nextResult = nextResultByIndex.get(shot.index);
        const nextKeyframeUrl =
          videoModel.supportsLastFrame && nextResult
            ? nextResult.keyframeUrl
            : undefined;

        validateVideoRequest({
          model: videoModel,
          aspectRatio: campaign.aspectRatio,
          durationSeconds,
          hasLastFrame: Boolean(nextKeyframeUrl),
          hasFirstFrame: true,
        });

        // Live OpenRouter video jobs require public HTTPS frame images. The
        // storage adapter uploads local fixtures/keyframes when configured and
        // leaves local paths untouched in mock/hybrid mode.
        const firstFrameUrl =
          await this.dependencies.storage.ensurePublicHttpsUrl(
            result.keyframeUrl,
            frameFileName(campaign.id, shot.index, 'first', result.keyframeUrl),
          );
        const lastFrameUrl =
          nextKeyframeUrl !== undefined && nextKeyframeUrl !== ''
            ? await this.dependencies.storage.ensurePublicHttpsUrl(
                nextKeyframeUrl,
                frameFileName(campaign.id, shot.index, 'last', nextKeyframeUrl),
              )
            : undefined;

        const submission = await this.dependencies.video.submitImageToVideo({
          prompt: buildVideoMotionPrompt(shot.videoMotionPrompt),
          firstFrameUrl,
          lastFrameUrl,
          aspectRatio: campaign.aspectRatio,
          durationSeconds,
          model: videoModel.id,
        });

        return { shotIndex: shot.index, submission };
      },
    );

    let ledger = campaign.ledger;

    for (const entry of submitted) {
      ledger = appendCostEntry(ledger, {
        step: 'video',
        model: entry.submission.model,
        costUsd: entry.submission.estimatedCostUsd,
        note: `Shot ${entry.shotIndex} queued as ${entry.submission.jobId} (estimated)`,
      });
    }

    assertWithinBudget(ledger, 0);

    const submittedByIndex = new Map(
      submitted.map((entry) => [entry.shotIndex, entry.submission]),
    );

    const results: ShotResult[] = orderedShots.map((shot) => {
      const result = resultByIndex.get(shot.index);
      const submission = submittedByIndex.get(shot.index);

      if (!result || !submission) {
        throw new InvalidWorkflowStateError(
          `Shot ${shot.index} is missing its video submission.`,
        );
      }

      return {
        ...result,
        videoJobId: submission.jobId,
        videoStatus: 'queued',
        videoProgress: 0,
        videoPlaybackUrl: undefined,
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
}
