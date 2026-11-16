import { z } from 'zod';
import type { AspectRatio } from '@/domain/entities/campaign';
import type {
  ImageModelCapability,
  VideoAudioMode,
  VideoDurationSeconds,
  VideoFrameImageType,
  VideoModelCapability,
  VideoResolution,
} from '@/domain/entities/model-capabilities';
import type { ModelsSnapshot } from './model-catalog';
import { OPENROUTER_APP_TITLE, OPENROUTER_API_BASE_URL } from './openrouter-client';

/**
 * Live capability refresh for OpenRouter's image and video model catalogs.
 *
 * The curated `models-snapshot.json` file remains the instant, offline-safe
 * source of truth. This module only enriches the curated entries when the
 * studio explicitly asks for `?refresh=true`, and every network failure falls
 * back to the snapshot value for that model.
 */

const FETCH_TIMEOUT_MS = 7_000;

const ASPECT_RATIOS: readonly AspectRatio[] = ['9:16', '16:9', '1:1'];
const VIDEO_DURATIONS: readonly VideoDurationSeconds[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];
const VIDEO_RESOLUTIONS: readonly VideoResolution[] = [
  '360p',
  '480p',
  '720p',
  '768p',
  '1080p',
  '1K',
  '2K',
  '4K',
];
const VIDEO_FRAME_IMAGES: readonly VideoFrameImageType[] = [
  'first_frame',
  'last_frame',
];

const imageModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullish(),
    supported_parameters: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const imageModelsResponseSchema = z.object({
  data: z.array(imageModelSchema),
});

const imagePricingEntrySchema = z
  .object({
    billable: z.string().nullish(),
    unit: z.string().nullish(),
    cost_usd: z.number().nonnegative().nullish(),
  })
  .passthrough();

const imageEndpointsResponseSchema = z.object({
  endpoints: z
    .array(
      z
        .object({
          supported_parameters: z.record(z.string(), z.unknown()).nullish(),
          pricing: z.array(imagePricingEntrySchema).nullish(),
        })
        .passthrough(),
    )
    .nullish(),
});

const videoModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullish(),
    supported_resolutions: z.array(z.string()).nullish(),
    supported_aspect_ratios: z.array(z.string()).nullish(),
    supported_durations: z.array(z.number()).nullish(),
    supported_frame_images: z.array(z.string()).nullish(),
    pricing_skus: z
      .record(z.string(), z.union([z.string(), z.number()]).nullish())
      .nullish(),
  })
  .passthrough();

const videoModelsResponseSchema = z.object({
  data: z.array(videoModelSchema),
});

type ImageModelRecord = z.infer<typeof imageModelSchema>;
type VideoModelRecord = z.infer<typeof videoModelSchema>;
type StoredPricingSku = Record<
  string,
  string | number | null | undefined
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function filterAspectRatios(values: readonly string[]): AspectRatio[] {
  return unique(
    values.filter((value): value is AspectRatio =>
      ASPECT_RATIOS.includes(value as AspectRatio),
    ),
  );
}

function filterVideoDurations(values: readonly number[]): VideoDurationSeconds[] {
  return unique(
    values.filter((value): value is VideoDurationSeconds =>
      VIDEO_DURATIONS.includes(value as VideoDurationSeconds),
    ),
  );
}

function filterVideoResolutions(values: readonly string[]): VideoResolution[] {
  return unique(
    values.filter((value): value is VideoResolution =>
      VIDEO_RESOLUTIONS.includes(value as VideoResolution),
    ),
  );
}

function filterFrameImages(values: readonly string[]): VideoFrameImageType[] {
  return unique(
    values.filter((value): value is VideoFrameImageType =>
      VIDEO_FRAME_IMAGES.includes(value as VideoFrameImageType),
    ),
  );
}

function readDescriptorEnumValues(descriptor: unknown): string[] {
  if (!isRecord(descriptor)) return [];
  const values = descriptor.values;
  if (!Array.isArray(values)) return [];

  return values.filter((value): value is string => typeof value === 'string');
}

function readDescriptorMax(descriptor: unknown): number | null {
  if (!isRecord(descriptor)) return null;

  if (typeof descriptor.max === 'number' && Number.isFinite(descriptor.max)) {
    return Math.max(0, Math.trunc(descriptor.max));
  }

  const values = readDescriptorEnumValues(descriptor);
  if (values.length > 0) return values.length;

  return null;
}

function deriveVideoCostPerSecond(
  pricingSkus: StoredPricingSku | null | undefined,
  resolution: VideoResolution | undefined,
): number | undefined {
  if (pricingSkus === null || pricingSkus === undefined) return undefined;

  const resolutionKey = resolution?.toLowerCase();
  let best: { score: number; costUsd: number } | null = null;

  for (const [rawKey, rawValue] of Object.entries(pricingSkus)) {
    const key = rawKey.toLowerCase();
    if (!key.includes('second')) continue;
    if (rawValue === null || rawValue === undefined) continue;

    const numericValue =
      typeof rawValue === 'number' ? rawValue : Number.parseFloat(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) continue;

    // Some SKUs are quoted in cents (`cents_per_video_output_second_480p`).
    const costUsd = key.includes('cent') ? numericValue / 100 : numericValue;
    const matchesResolution =
      resolutionKey !== undefined && resolutionKey !== ''
        ? key.includes(resolutionKey)
        : false;
    const withoutAudio =
      key.includes('without_audio') || key.includes('no_audio');
    const withAudio = key.includes('with_audio') || key.includes('with sound');

    let score = 0;
    // The studio requests audio whenever the model exposes the flag, so the
    // with-audio SKU is the honest estimate. Without-audio SKUs are penalized.
    if (withAudio && !withoutAudio) score -= 10;
    if (withoutAudio) score += 10;
    if (matchesResolution) score -= 4;
    else score += 2;

    if (best === null || score < best.score) {
      best = { score, costUsd };
    }
  }

  return best === null
    ? undefined
    : Math.round(best.costUsd * 1_000_000) / 1_000_000;
}

function pickCostSafeResolution(
  resolutions: readonly VideoResolution[],
): VideoResolution | undefined {
  const preference: readonly VideoResolution[] = [
    '480p',
    '720p',
    '360p',
    '768p',
    '1080p',
    '1K',
    '2K',
    '4K',
  ];

  return preference.find((resolution) => resolutions.includes(resolution));
}

async function fetchJson(url: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Title': OPENROUTER_APP_TITLE,
  };

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (apiKey !== undefined && apiKey !== '') {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`OpenRouter catalog request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as unknown;
}

async function fetchImagePricingUsdPerImage(
  modelId: string,
): Promise<number | undefined> {
  const url = `${OPENROUTER_API_BASE_URL}/images/models/${modelId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}/endpoints`;
  const parsed = imageEndpointsResponseSchema.parse(await fetchJson(url));

  for (const endpoint of parsed.endpoints ?? []) {
    for (const price of endpoint.pricing ?? []) {
      if (
        price.billable === 'output_image' &&
        price.unit === 'image' &&
        price.cost_usd !== null &&
        price.cost_usd !== undefined &&
        price.cost_usd > 0
      ) {
        return price.cost_usd;
      }
    }
  }

  return undefined;
}

async function enrichImageModel(
  base: ImageModelCapability,
  live: ImageModelRecord,
): Promise<ImageModelCapability> {
  const supportedParameters = live.supported_parameters ?? {};
  const aspectRatios = filterAspectRatios(
    readDescriptorEnumValues(supportedParameters.aspect_ratio),
  );
  const maxReferences = readDescriptorMax(
    supportedParameters.input_references,
  );

  let estimatedCostPerImageUsd = base.estimatedCostPerImageUsd;

  try {
    const livePrice = await fetchImagePricingUsdPerImage(base.id);
    if (livePrice !== undefined) {
      estimatedCostPerImageUsd = livePrice;
    }
  } catch {
    // Pricing is optional; the curated estimate stays in place offline.
  }

  return {
    ...base,
    label: base.label,
    supportedAspectRatios:
      aspectRatios.length > 0 ? aspectRatios : base.supportedAspectRatios,
    supportsInputReferences:
      maxReferences === null
        ? base.supportsInputReferences
        : maxReferences > 0,
    maxInputReferences:
      maxReferences === null ? base.maxInputReferences : maxReferences,
    estimatedCostPerImageUsd,
  };
}

function enrichVideoModel(
  base: VideoModelCapability,
  live: VideoModelRecord,
): VideoModelCapability {
  const aspectRatios = filterAspectRatios(live.supported_aspect_ratios ?? []);
  const durations = filterVideoDurations(live.supported_durations ?? []);
  const resolutions = filterVideoResolutions(
    live.supported_resolutions ?? [],
  );
  const frameImages = filterFrameImages(live.supported_frame_images ?? []);

  // `generate_audio: true` means the request flag is supported. When OpenRouter
  // reports false/null the flag is not accepted; keep the curated behaviour
  // (HeyGen always renders audio) instead of guessing.
  const audioMode: VideoAudioMode =
    live.generate_audio === true
      ? 'optional'
      : base.audioMode === 'always' || base.audioMode === 'none'
        ? base.audioMode
        : 'unknown';

  const effectiveResolutions =
    resolutions.length > 0 ? resolutions : base.supportedResolutions;
  const livePrice = deriveVideoCostPerSecond(
    live.pricing_skus,
    pickCostSafeResolution(effectiveResolutions),
  );

  return {
    ...base,
    label: base.label,
    supportedAspectRatios:
      aspectRatios.length > 0 ? aspectRatios : base.supportedAspectRatios,
    supportedDurations:
      durations.length > 0 ? durations : base.supportedDurations,
    supportedResolutions: effectiveResolutions,
    supportedFrameImages:
      frameImages.length > 0 ? frameImages : base.supportedFrameImages,
    supportsLastFrame:
      frameImages.length > 0
        ? frameImages.includes('last_frame')
        : base.supportsLastFrame,
    audioMode,
    estimatedCostPerSecondUsd:
      livePrice !== undefined ? livePrice : base.estimatedCostPerSecondUsd,
  };
}

/**
 * Fetches both live catalogs and merges their metadata onto the curated
 * snapshot. Throws only when both catalogs are unreachable.
 */
export async function fetchLiveModelsSnapshot(
  base: ModelsSnapshot,
): Promise<ModelsSnapshot> {
  const [imageResult, videoResult] = await Promise.allSettled([
    fetchJson(`${OPENROUTER_API_BASE_URL}/images/models`),
    fetchJson(`${OPENROUTER_API_BASE_URL}/videos/models`),
  ]);

  if (imageResult.status === 'rejected' && videoResult.status === 'rejected') {
    throw new Error(
      `Both OpenRouter model catalogs are unreachable: ${String(
        imageResult.reason,
      )} / ${String(videoResult.reason)}`,
    );
  }

  const imageModels: ImageModelCapability[] = [];
  if (imageResult.status === 'fulfilled') {
    const parsed = imageModelsResponseSchema.parse(imageResult.value);
    const liveById = new Map(parsed.data.map((model) => [model.id, model]));

    const enriched = await Promise.all(
      base.imageModels.map(async (baseModel) => {
        const liveModel = liveById.get(baseModel.id);
        return liveModel === undefined
          ? baseModel
          : await enrichImageModel(baseModel, liveModel);
      }),
    );

    imageModels.push(...enriched);
  } else {
    imageModels.push(...base.imageModels);
  }

  const videoModels: VideoModelCapability[] = [];
  if (videoResult.status === 'fulfilled') {
    const parsed = videoModelsResponseSchema.parse(videoResult.value);
    const liveById = new Map(parsed.data.map((model) => [model.id, model]));

    for (const baseModel of base.videoModels) {
      const liveModel = liveById.get(baseModel.id);
      videoModels.push(
        liveModel === undefined
          ? baseModel
          : enrichVideoModel(baseModel, liveModel),
      );
    }
  } else {
    videoModels.push(...base.videoModels);
  }

  return {
    chatModels: base.chatModels,
    imageModels,
    videoModels,
  };
}
