import type {
  ShotPlan,
  ShotResult,
} from '@/domain/entities/campaign';
import type {
  AssetStoragePort,
  CreativeDirectorPort,
  DirectorOutput,
  ImageGenOutput,
  ImageGenPort,
  VideoGenPort,
  VideoJobStatus,
  VideoJobSubmission,
  VisionQaOutput,
  VisionQaPort,
} from '@/domain/ports/media-ports';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mockPollCounter = new Map<string, number>();
const mockPlaybackUrls = new Map<string, string>();

function resolveMockKeyframeUrl(input: {
  prompt: string;
  referenceImageUrls: string[];
}): string {
  const prompt = input.prompt.toLowerCase();

  if (prompt.includes('oud al-sahara')) {
    if (prompt.includes('macro-finale')) {
      return '/fixtures/oud-perfume/shot-3.jpeg';
    }
    if (prompt.includes('lifestyle-context')) {
      return '/fixtures/oud-perfume/shot-2.jpeg';
    }
    return '/fixtures/oud-perfume/shot-1.jpeg';
  }

  if (prompt.includes('chronos apex')) {
    return '/fixtures/chronos-watch/shot-1.jpeg';
  }

  return input.referenceImageUrls[0] || '/fixtures/perfume-anchor.jpeg';
}

function resolveMockPlaybackUrl(firstFrameUrl: string): string {
  if (firstFrameUrl.includes('/fixtures/oud-perfume/shot-3')) {
    return '/fixtures/oud-perfume/shot-3.mp4';
  }
  if (firstFrameUrl.includes('/fixtures/oud-perfume/shot-2')) {
    return '/fixtures/oud-perfume/shot-2.mp4';
  }
  if (firstFrameUrl.includes('/fixtures/oud-perfume/shot-1')) {
    return '/fixtures/oud-perfume/shot-1.mp4';
  }
  if (firstFrameUrl.includes('/fixtures/chronos-watch/shot-1')) {
    return '/fixtures/chronos-watch/shot-1.mp4';
  }

  return '/fixtures/sample-clip.mp4';
}

export class MockDirectorAdapter implements CreativeDirectorPort {
  async planCampaign(
    input: Parameters<CreativeDirectorPort['planCampaign']>[0],
  ): Promise<DirectorOutput> {
    await sleep(700);

    const shots: [ShotPlan, ShotPlan, ShotPlan] = [
      {
        index: 1,
        role: 'hero-packshot',
        title: 'Hero Pedestal & Relighting',
        imagePrompt: `Shot 1 (hero-packshot): editorial studio packshot of ${input.product.name} on warm travertine stone, dramatic golden rim lighting, 85mm lens`,
        videoMotionPrompt:
          'Slow cinematic orbit push-in with subtle light sweep across product surface',
      },
      {
        index: 2,
        role: 'lifestyle-context',
        title: 'Dubai Sunset Lifestyle',
        imagePrompt: `Shot 2 (lifestyle-context): ${input.product.name} placed naturally on a luxury marble terrace overlooking desert sunset, shallow depth of field`,
        videoMotionPrompt:
          'Gentle handheld parallax drift with warm ambient breeze and soft bokeh',
      },
      {
        index: 3,
        role: 'macro-finale',
        title: 'Macro Detail Finale',
        imagePrompt: `Shot 3 (macro-finale): extreme macro close-up of ${input.product.name} with micro water droplets and specular highlights, dark luxury backdrop`,
        videoMotionPrompt:
          'Smooth macro pull-back reveal with shimmering light particles',
      },
    ];

    return {
      productDna: `${input.product.name} (${input.product.category}): exact geometry, original brand label preserved, crisp edges, studio reflections.`,
      adCopy: {
        hook: 'Crafted for Dubai golden hour.',
        headline: `${input.product.name} — Pure Presence.`,
        cta: 'Shop Limited Drop',
      },
      shots,
      costUsd: 0,
      model: 'mock/director-v1',
    };
  }
}

export class MockImageAdapter implements ImageGenPort {
  async generateKeyframe(
    input: Parameters<ImageGenPort['generateKeyframe']>[0],
  ): Promise<ImageGenOutput> {
    await sleep(900);

    return {
      publicUrl: resolveMockKeyframeUrl(input),
      costUsd: 0,
      model: `mock/${input.model}`,
    };
  }
}

/**
 * Deterministic demo adapter.
 *
 * Shot 2 / lifestyle-context deliberately fails the first fidelity check so the
 * self-healing Vision QA loop is visible in mock mode. Once the prompt contains
 * the refinement marker, the same shot scores 9/10.
 */
export class MockVisionQaAdapter implements VisionQaPort {
  async evaluateProductFidelity(
    input: Parameters<VisionQaPort['evaluateProductFidelity']>[0],
  ): Promise<VisionQaOutput> {
    await sleep(450);

    const prompt = input.originalPrompt;
    const isDemoShot =
      /\bShot 2\b/.test(prompt) ||
      prompt.toLowerCase().includes('lifestyle-context');
    const hasBeenRefined = prompt
      .toLowerCase()
      .includes('razor sharp product typography');

    if (isDemoShot && !hasBeenRefined) {
      return {
        fidelityScore: 6,
        defects: ['Slight label reflection distortion'],
        refinedPrompt: `${prompt}, razor sharp product typography and exact label preservation`,
        costUsd: 0,
        model: 'mock/vision-qa-v1',
      };
    }

    return {
      fidelityScore: 9,
      defects: [],
      refinedPrompt: '',
      costUsd: 0,
      model: 'mock/vision-qa-v1',
    };
  }
}

export class MockVideoAdapter implements VideoGenPort {
  async submitImageToVideo(
    input: Parameters<VideoGenPort['submitImageToVideo']>[0],
  ): Promise<VideoJobSubmission> {
    await sleep(400);

    const jobId = `mock-vid-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    mockPollCounter.set(jobId, 0);
    mockPlaybackUrls.set(jobId, resolveMockPlaybackUrl(input.firstFrameUrl));

    return {
      jobId,
      model: `mock/${input.model}`,
      estimatedCostUsd: 0,
    };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    await sleep(300);

    const count = (mockPollCounter.get(jobId) ?? 0) + 1;
    mockPollCounter.set(jobId, count);

    if (count === 1) {
      return { jobId, status: 'queued', progress: 15 };
    }

    if (count === 2) {
      return { jobId, status: 'processing', progress: 60 };
    }

    return {
      jobId,
      status: 'completed',
      progress: 100,
      playbackUrl:
        mockPlaybackUrls.get(jobId) ?? '/fixtures/sample-clip.mp4',
      actualCostUsd: 0,
    };
  }
}

export class MockAssetStorageAdapter implements AssetStoragePort {
  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    void b64Json;
    void filename;
    return '/fixtures/perfume-anchor.jpeg';
  }
}

/**
 * Helper used by the showcase presets to keep their pre-baked result shape
 * aligned with the domain contract.
 */
export function createCompletedShotResult(
  shotIndex: ShotResult['shotIndex'],
  keyframeUrl: string,
  qaFeedback: string,
  options: {
    wasRetried?: boolean;
    videoJobId: string;
    playbackUrl?: string;
  },
): ShotResult {
  return {
    shotIndex,
    keyframeUrl,
    fidelityScore: 9,
    qaFeedback,
    wasRetried: options.wasRetried ?? false,
    videoJobId: options.videoJobId,
    videoStatus: 'completed',
    videoProgress: 100,
    videoPlaybackUrl: options.playbackUrl ?? '/fixtures/sample-clip.mp4',
  };
}
