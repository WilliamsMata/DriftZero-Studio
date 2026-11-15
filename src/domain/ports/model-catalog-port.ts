import type {
  ImageModelCapability,
  VideoModelCapability,
} from '../entities/model-capabilities';

export interface ModelCatalogPort {
  listImageModels(): readonly ImageModelCapability[];
  listVideoModels(): readonly VideoModelCapability[];
  getImageModel(modelId: string): ImageModelCapability | undefined;
  getVideoModel(modelId: string): VideoModelCapability | undefined;
}
