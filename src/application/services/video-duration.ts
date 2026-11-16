import type {
  VideoDurationSeconds,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { DEFAULT_VIDEO_DURATION_SECONDS } from './media-constants';

/**
 * Picks a safe duration for a video model. The product currently allows only
 * 4s and 5s, so a model that does not support the default 4s falls back to its
 * first supported duration (for example HeyGen, which starts at 5s).
 */
export function resolveVideoDurationSeconds(
  catalog: ModelCatalogPort,
  videoModelId: string,
): VideoDurationSeconds {
  const model = catalog.getVideoModel(videoModelId);
  return resolveDurationForModel(model);
}

export function resolveDurationForModel(
  model: VideoModelCapability | undefined,
): VideoDurationSeconds {
  if (!model) return DEFAULT_VIDEO_DURATION_SECONDS;
  if (model.supportedDurations.includes(DEFAULT_VIDEO_DURATION_SECONDS)) {
    return DEFAULT_VIDEO_DURATION_SECONDS;
  }
  return model.supportedDurations[0] ?? DEFAULT_VIDEO_DURATION_SECONDS;
}
