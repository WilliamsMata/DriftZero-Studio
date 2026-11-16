import { z } from 'zod';
import type { VideoModelCapability } from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type {
  VideoGenPort,
  VideoJobStatus,
  VideoJobSubmission,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { modelCatalog } from './model-catalog';
import { OpenRouterClient } from './openrouter-client';

const submitResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  polling_url: z.string().optional(),
});

const pollResponseSchema = z.object({
  id: z.string().optional(),
  status: z.string(),
  usage: z
    .object({
      cost: z.number().nonnegative().optional(),
    })
    .optional(),
  error: z
    .union([
      z.string(),
      z.object({
        message: z.string().optional(),
        code: z.string().optional(),
      }),
    ])
    .optional(),
});

const RESOLUTION_PREFERENCE = [
  '480p',
  '720p',
  '360p',
  '768p',
  '1080p',
  '1K',
  '2K',
  '4K',
] as const;

type FrameImageRequest = {
  type: 'image_url';
  image_url: { url: string };
  frame_type: 'first_frame' | 'last_frame';
};

export interface OpenRouterVideoAdapterOptions {
  client?: OpenRouterClient;
  catalog?: ModelCatalogPort;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pickCostSafeResolution(model: VideoModelCapability): string {
  for (const resolution of RESOLUTION_PREFERENCE) {
    if (model.supportedResolutions.includes(resolution)) {
      return resolution;
    }
  }

  return model.supportedResolutions[0] ?? '720p';
}

function isPublicHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' &&
      url.hostname !== '::1'
    );
  } catch {
    return false;
  }
}

function requirePublicFrameUrl(
  modelId: string,
  label: 'first-frame' | 'last-frame',
  url: string,
): void {
  if (isPublicHttpsUrl(url)) return;

  const displayUrl =
    url.length > 180 ? `${url.slice(0, 180)}…` : url;

  throw new ProviderCapabilityError(
    modelId,
    `live OpenRouter video generation requires a public HTTPS ${label} URL that returns 200 OK with an image content type. Set BLOB_READ_WRITE_TOKEN so keyframes are hosted on Vercel Blob before submission (received "${displayUrl}").`,
  );
}

function readErrorMessage(
  error: z.infer<typeof pollResponseSchema>['error'],
  fallback: string,
): string {
  if (typeof error === 'string' && error.trim() !== '') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    error.message !== undefined &&
    error.message.trim() !== ''
  ) {
    return error.message;
  }

  return fallback;
}

export class OpenRouterVideoAdapter implements VideoGenPort {
  private readonly client: OpenRouterClient;
  private readonly catalog: ModelCatalogPort;

  constructor(options: OpenRouterVideoAdapterOptions = {}) {
    this.client = options.client ?? new OpenRouterClient({ mode: 'live' });
    this.catalog = options.catalog ?? modelCatalog;
  }

  async submitImageToVideo(
    input: Parameters<VideoGenPort['submitImageToVideo']>[0],
  ): Promise<VideoJobSubmission> {
    const model = this.resolveModel(input.model);

    if (!model.supportedAspectRatios.includes(input.aspectRatio)) {
      throw new ProviderCapabilityError(
        input.model,
        `aspect ratio "${input.aspectRatio}" is not supported. Supported ratios: ${model.supportedAspectRatios.join(
          ', ',
        )}.`,
      );
    }

    if (!model.supportedDurations.includes(input.durationSeconds)) {
      throw new ProviderCapabilityError(
        input.model,
        `duration ${input.durationSeconds}s is not supported. Supported durations: ${model.supportedDurations
          .map((duration) => `${duration}s`)
          .join(', ')}.`,
      );
    }

    requirePublicFrameUrl(input.model, 'first-frame', input.firstFrameUrl);

    if (!model.supportedFrameImages.includes('first_frame')) {
      throw new ProviderCapabilityError(
        input.model,
        'first-frame image-to-video conditioning is not supported by this model.',
      );
    }

    const frameImages: FrameImageRequest[] = [
      {
        type: 'image_url',
        image_url: { url: input.firstFrameUrl },
        frame_type: 'first_frame',
      },
    ];

    if (
      input.lastFrameUrl !== undefined &&
      input.lastFrameUrl.trim() !== '' &&
      model.supportedFrameImages.includes('last_frame')
    ) {
      requirePublicFrameUrl(input.model, 'last-frame', input.lastFrameUrl);

      frameImages.push({
        type: 'image_url',
        image_url: { url: input.lastFrameUrl },
        frame_type: 'last_frame',
      });
    }

    const resolution = pickCostSafeResolution(model);
    const requestBody: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      duration: input.durationSeconds,
      resolution,
      frame_images: frameImages,
    };

    // OpenRouter rejects `generate_audio` for models that do not expose the
    // flag (HeyGen always renders an audio track, for example). Only send it
    // when the catalog says the model supports toggling, and request audio
    // because the final cut is played with sound in the studio.
    if (model.audioMode === 'optional') {
      requestBody.generate_audio = true;
    }

    const rawResponse = await this.client.requestJson<unknown>(
      '/videos',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      60_000,
    );

    const response = submitResponseSchema.parse(rawResponse);

    return {
      jobId: response.id,
      model: input.model,
      estimatedCostUsd: roundUsd(
        model.estimatedCostPerSecondUsd * input.durationSeconds,
      ),
    };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    const normalizedJobId = jobId.trim();

    if (normalizedJobId === '') {
      throw new ProviderCapabilityError(
        'openrouter/video',
        'a video job ID is required to poll status.',
      );
    }

    const rawResponse = await this.client.requestJson<unknown>(
      `/videos/${encodeURIComponent(normalizedJobId)}`,
      { method: 'GET' },
      60_000,
    );

    const response = pollResponseSchema.parse(rawResponse);
    const actualCostUsd = response.usage?.cost;

    switch (response.status) {
      case 'pending':
        return {
          jobId: normalizedJobId,
          status: 'queued',
          progress: 20,
          actualCostUsd,
        };

      case 'in_progress':
        return {
          jobId: normalizedJobId,
          status: 'processing',
          progress: 65,
          actualCostUsd,
        };

      case 'completed':
        return {
          jobId: normalizedJobId,
          status: 'completed',
          progress: 100,
          playbackUrl: `/api/videos/${encodeURIComponent(
            normalizedJobId,
          )}/content`,
          actualCostUsd,
        };

      case 'failed':
      case 'cancelled':
      case 'expired':
        return {
          jobId: normalizedJobId,
          status: 'failed',
          progress: 100,
          actualCostUsd,
          errorMessage: readErrorMessage(response.error, response.status),
        };

      default:
        return {
          jobId: normalizedJobId,
          status: 'failed',
          progress: 100,
          actualCostUsd,
          errorMessage: `Unexpected OpenRouter video status "${response.status}".`,
        };
    }
  }

  private resolveModel(modelId: string): VideoModelCapability {
    const model = this.catalog.getVideoModel(modelId);

    if (!model) {
      throw new ProviderCapabilityError(
        modelId,
        'unknown video model. Reload the capability catalog and pick a supported model.',
      );
    }

    return model;
  }
}
