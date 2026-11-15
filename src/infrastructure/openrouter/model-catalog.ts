import { z } from 'zod';
import type {
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import snapshot from './models-snapshot.json';

const aspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);
const videoDurationSchema = z.union([z.literal(4), z.literal(5)]);

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
  supportsLastFrame: z.boolean(),
  estimatedCostPerSecondUsd: z.number().nonnegative(),
});

const modelsSnapshotSchema = z.object({
  imageModels: z.array(imageModelCapabilitySchema).min(1),
  videoModels: z.array(videoModelCapabilitySchema).min(1),
});

export type ModelsSnapshot = z.infer<typeof modelsSnapshotSchema>;

export class LocalModelCatalogAdapter implements ModelCatalogPort {
  private readonly imageModels: readonly ImageModelCapability[];
  private readonly videoModels: readonly VideoModelCapability[];
  private readonly imageModelsById: ReadonlyMap<string, ImageModelCapability>;
  private readonly videoModelsById: ReadonlyMap<string, VideoModelCapability>;

  constructor(parsedSnapshot: ModelsSnapshot) {
    this.imageModels = parsedSnapshot.imageModels;
    this.videoModels = parsedSnapshot.videoModels;
    this.imageModelsById = new Map(
      this.imageModels.map((model) => [model.id, model]),
    );
    this.videoModelsById = new Map(
      this.videoModels.map((model) => [model.id, model]),
    );
  }

  listImageModels(): readonly ImageModelCapability[] {
    return this.imageModels;
  }

  listVideoModels(): readonly VideoModelCapability[] {
    return this.videoModels;
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

export const DEFAULT_IMAGE_MODEL_ID = 'google/gemini-2.5-flash-image';
export const DEFAULT_VIDEO_MODEL_ID = 'bytedance/seedance-2.0-fast';
