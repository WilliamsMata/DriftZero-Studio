import type {
  ChatModelCapability,
  ImageModelCapability,
  VideoModelCapability,
} from '../entities/model-capabilities';

export interface ModelCatalogPort {
  listChatModels(): readonly ChatModelCapability[];
  listImageModels(): readonly ImageModelCapability[];
  listVideoModels(): readonly VideoModelCapability[];
  getChatModel(modelId: string): ChatModelCapability | undefined;
  getImageModel(modelId: string): ImageModelCapability | undefined;
  getVideoModel(modelId: string): VideoModelCapability | undefined;
}
