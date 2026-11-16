import { describe, expect, it } from 'vitest';
import {
  SubmitVideosUseCase,
  type SubmitVideosDependencies,
} from '@/application/use-cases/submit-videos';
import type {
  CampaignState,
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import {
  shotRoleForIndex,
  shotTitleForIndex,
} from '@/domain/entities/shot-sequence';
import type { VideoModelCapability } from '@/domain/entities/model-capabilities';
import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type {
  AssetStoragePort,
  VideoGenPort,
  VideoJobStatus,
  VideoJobSubmission,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

const videoModel: VideoModelCapability = {
  id: 'test/video-model',
  label: 'Test Video Model',
  provider: 'Test Provider',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: true,
  maxInputReferences: 1,
  supportedDurations: [4],
  supportedResolutions: ['720p'],
  supportedFrameImages: ['first_frame'],
  supportsLastFrame: false,
  audioMode: 'none',
  estimatedCostPerSecondUsd: 0.02,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [],
  getChatModel: () => undefined,
  listImageModels: () => [],
  getImageModel: () => undefined,
  listVideoModels: () => [videoModel],
  getVideoModel: (modelId) =>
    modelId === videoModel.id ? videoModel : undefined,
};

class TrackingVideoAdapter implements VideoGenPort {
  active = 0;
  maxActive = 0;
  submissions = 0;
  readonly prompts: string[] = [];

  async submitImageToVideo(
    input: Parameters<VideoGenPort['submitImageToVideo']>[0],
  ): Promise<VideoJobSubmission> {
    this.active += 1;
    this.submissions += 1;
    this.prompts.push(input.prompt);
    this.maxActive = Math.max(this.maxActive, this.active);

    await new Promise((resolve) => setTimeout(resolve, 5));

    this.active -= 1;

    return {
      jobId: `job-${this.submissions}`,
      model: input.model,
      estimatedCostUsd: 0.08,
    };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    return { jobId, status: 'queued', progress: 0 };
  }
}

class FakeStorageAdapter implements AssetStoragePort {
  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    void b64Json;
    void filename;
    return '/fixtures/generated.jpeg';
  }

  async ensurePublicHttpsUrl(source: string): Promise<string> {
    return source;
  }
}

function createCampaign(shotCount: number): CampaignState {
  const shots: ShotPlan[] = Array.from(
    { length: shotCount },
    (_, position): ShotPlan => {
      const index = position + 1;

      return {
        index,
        role: shotRoleForIndex(index, shotCount),
        title: shotTitleForIndex(index, shotCount),
        imagePrompt: `Keyframe prompt ${index}`,
        videoMotionPrompt: `Motion prompt ${index}`,
      };
    },
  );

  const results: ShotResult[] = shots.map((shot) => ({
    shotIndex: shot.index,
    keyframeUrl: `/fixtures/shot-${shot.index}.jpeg`,
    fidelityScore: 9,
    qaFeedback: '9/10 product fidelity.',
    wasRetried: false,
    videoStatus: 'idle',
    videoProgress: 0,
  }));

  return {
    id: 'test-campaign',
    mode: 'mock',
    aspectRatio: '9:16',
    tone: 'luxury-editorial',
    product: {
      name: 'Test Serum',
      category: 'Skincare',
      imageUrl: '/fixtures/perfume-anchor.jpeg',
    },
    productDna: 'Amber glass bottle with exact label preservation.',
    adCopy: {
      hook: 'Test hook',
      headline: 'Test headline',
      cta: 'Test CTA',
    },
    shots,
    results,
    ledger: {
      totalUsd: 0,
      maxBudgetUsd: 1.5,
      entries: [],
    },
  };
}

function createUseCase(video: VideoGenPort): SubmitVideosUseCase {
  const dependencies: SubmitVideosDependencies = {
    video,
    storage: new FakeStorageAdapter(),
    catalog,
  };

  return new SubmitVideosUseCase(dependencies);
}

describe('SubmitVideosUseCase', () => {
  it('submits a five-shot campaign in parallel and keeps result order', async () => {
    const video = new TrackingVideoAdapter();
    const output = await createUseCase(video).execute({
      campaign: createCampaign(5),
      videoModel: videoModel.id,
      durationSeconds: 4,
    });

    expect(video.submissions).toBe(5);
    expect(video.maxActive).toBeGreaterThan(1);
    expect(
      video.prompts.every((prompt) =>
        prompt.includes('PRODUCT FIDELITY RULES FOR MOTION'),
      ),
    ).toBe(true);
    expect(
      video.prompts.every((prompt) =>
        prompt.includes('Do not morph, warp, recolor, relabel, replace'),
      ),
    ).toBe(true);
    expect(output.results.map((result) => result.shotIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(
      output.ledger.entries.filter((entry) => entry.step === 'video'),
    ).toHaveLength(5);
  });

  it('supports a single-shot campaign', async () => {
    const video = new TrackingVideoAdapter();
    const output = await createUseCase(video).execute({
      campaign: createCampaign(1),
      videoModel: videoModel.id,
      durationSeconds: 4,
    });

    expect(video.submissions).toBe(1);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]?.videoStatus).toBe('queued');
  });

  it('rejects plans without a keyframe for every shot', async () => {
    const campaign = createCampaign(3);
    const broken: CampaignState = {
      ...campaign,
      results: campaign.results.map((result, position) =>
        position === 1 ? { ...result, keyframeUrl: '' } : result,
      ),
    };

    await expect(
      createUseCase(new TrackingVideoAdapter()).execute({
        campaign: broken,
        videoModel: videoModel.id,
        durationSeconds: 4,
      }),
    ).rejects.toBeInstanceOf(InvalidWorkflowStateError);
  });
});
