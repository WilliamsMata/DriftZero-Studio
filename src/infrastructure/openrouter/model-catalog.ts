import { z } from 'zod';
import type {
  ChatModelCapability,
  ImageModelCapability,
  VideoDurationSeconds,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { fetchLiveModelsSnapshot } from './live-model-discovery';
import snapshot from './models-snapshot.json';

const aspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);
const videoDurationSchema = z.custom<VideoDurationSeconds>(
  (value) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10,
);
const videoResolutionSchema = z.enum([
  '360p',
  '480p',
  '720p',
  '768p',
  '1080p',
  '1K',
  '2K',
  '4K',
]);
const videoFrameImageSchema = z.enum(['first_frame', 'last_frame']);
const videoAudioModeSchema = z.enum(['always', 'optional', 'none', 'unknown']);

const chatModelCapabilitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  inputCostPerMillionUsd: z.number().nonnegative(),
  outputCostPerMillionUsd: z.number().nonnegative(),
  supportsVision: z.boolean(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
});

const imageModelCapabilitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  supportedAspectRatios: z.array(aspectRatioSchema).min(1),
  supportsInputReferences: z.boolean(),
  maxInputReferences: z.number().int().min(0),
  estimatedCostPerImageUsd: z.number().nonnegative(),
});

const videoModelCapabilitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  supportedAspectRatios: z.array(aspectRatioSchema).min(1),
  supportsInputReferences: z.boolean(),
  maxInputReferences: z.number().int().min(0),
  supportedDurations: z.array(videoDurationSchema).min(1),
  supportedResolutions: z.array(videoResolutionSchema).min(1),
  supportedFrameImages: z.array(videoFrameImageSchema).min(1),
  supportsLastFrame: z.boolean(),
  audioMode: videoAudioModeSchema,
  estimatedCostPerSecondUsd: z.number().nonnegative(),
});

const modelsSnapshotSchema = z.object({
  chatModels: z.array(chatModelCapabilitySchema).min(1),
  imageModels: z.array(imageModelCapabilitySchema).min(1),
  videoModels: z.array(videoModelCapabilitySchema).min(1),
});

export type ModelsSnapshot = z.infer<typeof modelsSnapshotSchema>;

export class LocalModelCatalogAdapter implements ModelCatalogPort {
  private readonly chatModels: readonly ChatModelCapability[];
  private readonly imageModels: readonly ImageModelCapability[];
  private readonly videoModels: readonly VideoModelCapability[];
  private readonly chatModelsById: ReadonlyMap<string, ChatModelCapability>;
  private readonly imageModelsById: ReadonlyMap<string, ImageModelCapability>;
  private readonly videoModelsById: ReadonlyMap<string, VideoModelCapability>;

  constructor(parsedSnapshot: ModelsSnapshot) {
    this.chatModels = parsedSnapshot.chatModels;
    this.imageModels = parsedSnapshot.imageModels;
    this.videoModels = parsedSnapshot.videoModels;
    this.chatModelsById = new Map(
      this.chatModels.map((model) => [model.id, model]),
    );
    this.imageModelsById = new Map(
      this.imageModels.map((model) => [model.id, model]),
    );
    this.videoModelsById = new Map(
      this.videoModels.map((model) => [model.id, model]),
    );
  }

  listChatModels(): readonly ChatModelCapability[] {
    return this.chatModels;
  }

  listImageModels(): readonly ImageModelCapability[] {
    return this.imageModels;
  }

  listVideoModels(): readonly VideoModelCapability[] {
    return this.videoModels;
  }

  getChatModel(modelId: string): ChatModelCapability | undefined {
    return this.chatModelsById.get(modelId);
  }

  getImageModel(modelId: string): ImageModelCapability | undefined {
    return this.imageModelsById.get(modelId);
  }

  getVideoModel(modelId: string): VideoModelCapability | undefined {
    return this.videoModelsById.get(modelId);
  }
}

const parsedSnapshot = modelsSnapshotSchema.parse(snapshot);

export const modelCatalog = new LocalModelCatalogAdapter(parsedSnapshot);

export const DEFAULT_TEXT_MODEL_ID = 'deepseek/deepseek-v4.1-flash';
export const DEFAULT_VISION_QA_MODEL_ID = 'deepseek/deepseek-v4.1-flash';
export const DEFAULT_BRIEF_MODEL_ID = 'meta/muse-ember';
export const DEFAULT_IMAGE_MODEL_ID = 'black-forest-labs/flux-3-image-klein';
export const DEFAULT_VIDEO_MODEL_ID = 'heygen/heygen-video-1';

function readModelIdFromEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function resolveConfiguredModelId(
  envName: string,
  fallbackId: string,
  exists: (id: string) => boolean,
): string {
  const configured = readModelIdFromEnv(envName);
  if (configured === null) return fallbackId;
  if (exists(configured)) return configured;

  console.warn(
    `[driftzero-catalog] ${envName}="${configured}" is missing or lacks required capabilities; falling back to ${fallbackId}.`,
  );
  return fallbackId;
}

/** Default creative-director model, overridable with `OPENROUTER_TEXT_MODEL`. */
export function getDefaultTextModelId(): string {
  return resolveConfiguredModelId(
    'OPENROUTER_TEXT_MODEL',
    DEFAULT_TEXT_MODEL_ID,
    // The director receives the product anchor image, so text-only models
    // cannot be used for planning.
    (id) => modelCatalog.getChatModel(id)?.supportsVision === true,
  );
}

/** Default Vision QA model, overridable with `OPENROUTER_VISION_QA_MODEL`. */
export function getDefaultVisionQaModelId(): string {
  return resolveConfiguredModelId(
    'OPENROUTER_VISION_QA_MODEL',
    DEFAULT_VISION_QA_MODEL_ID,
    (id) => modelCatalog.getChatModel(id)?.supportsVision === true,
  );
}

/**
 * Fast text-only model used for one-click creative brief drafts, overridable
 * with `OPENROUTER_BRIEF_MODEL`. Any chat model works: the brief never sends
 * the product image.
 */
export function getDefaultBriefModelId(): string {
  return resolveConfiguredModelId(
    'OPENROUTER_BRIEF_MODEL',
    DEFAULT_BRIEF_MODEL_ID,
    (id) => modelCatalog.getChatModel(id) !== undefined,
  );
}

/** Default image model, overridable with `OPENROUTER_IMAGE_MODEL`. */
export function getDefaultImageModelId(): string {
  return resolveConfiguredModelId(
    'OPENROUTER_IMAGE_MODEL',
    DEFAULT_IMAGE_MODEL_ID,
    (id) => modelCatalog.getImageModel(id) !== undefined,
  );
}

/** Default video model, overridable with `OPENROUTER_VIDEO_MODEL`. */
export function getDefaultVideoModelId(): string {
  return resolveConfiguredModelId(
    'OPENROUTER_VIDEO_MODEL',
    DEFAULT_VIDEO_MODEL_ID,
    (id) => modelCatalog.getVideoModel(id) !== undefined,
  );
}

const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;

interface LiveCatalogCache {
  snapshot: ModelsSnapshot;
  fetchedAt: number;
}

export type ModelCatalogSource = 'snapshot' | 'live';

export interface ResolvedModelCatalog {
  snapshot: ModelsSnapshot;
  catalog: ModelCatalogPort;
  source: ModelCatalogSource;
  refreshedAt: string | null;
}

let liveCache: LiveCatalogCache | null = null;
let liveRefreshInFlight: Promise<ModelsSnapshot | null> | null = null;

function toLocalView(): ResolvedModelCatalog {
  return {
    snapshot: parsedSnapshot,
    catalog: modelCatalog,
    source: 'snapshot',
    refreshedAt: null,
  };
}

function toLiveView(cache: LiveCatalogCache): ResolvedModelCatalog {
  return {
    snapshot: cache.snapshot,
    catalog: new LocalModelCatalogAdapter(cache.snapshot),
    source: 'live',
    refreshedAt: new Date(cache.fetchedAt).toISOString(),
  };
}

async function refreshLiveSnapshot(): Promise<ModelsSnapshot | null> {
  if (liveRefreshInFlight !== null) return liveRefreshInFlight;

  liveRefreshInFlight = (async (): Promise<ModelsSnapshot | null> => {
    try {
      const merged = await fetchLiveModelsSnapshot(parsedSnapshot);
      liveCache = { snapshot: merged, fetchedAt: Date.now() };
      return merged;
    } catch (error) {
      console.warn(
        '[driftzero-catalog] Live model refresh failed; serving models-snapshot.json.',
        error instanceof Error ? error.message : error,
      );
      return null;
    } finally {
      liveRefreshInFlight = null;
    }
  })();

  return liveRefreshInFlight;
}

/**
 * Returns the catalog used by `/api/models`.
 *
 * Without `refresh`, the curated snapshot is returned instantly (unless a
 * recent live merge is still inside the TTL). With `refresh`, OpenRouter's
 * public image/video catalogs are merged in; any failure keeps the app fully
 * functional on the snapshot.
 */
export async function resolveModelCatalog(
  options: { refresh?: boolean } = {},
): Promise<ResolvedModelCatalog> {
  const isCacheFresh =
    liveCache !== null &&
    Date.now() - liveCache.fetchedAt < LIVE_CACHE_TTL_MS;

  if (!options.refresh) {
    return isCacheFresh && liveCache !== null
      ? toLiveView(liveCache)
      : toLocalView();
  }

  if (!isCacheFresh) {
    await refreshLiveSnapshot();
  }

  return liveCache !== null ? toLiveView(liveCache) : toLocalView();
}
