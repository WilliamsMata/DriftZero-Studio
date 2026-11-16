import type {
  ChatModelCapability,
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

export function requireChatModel(
  catalog: ModelCatalogPort,
  modelId: string,
): ChatModelCapability {
  const model = catalog.getChatModel(modelId);

  if (!model) {
    const available = catalog.listChatModels().map((item) => item.id);
    throw new ProviderCapabilityError(
      modelId,
      `unknown chat model. Available models: ${available.join(', ') || 'none'}.`,
    );
  }

  return model;
}

export function requireVisionModel(
  catalog: ModelCatalogPort,
  modelId: string,
  purpose = 'Vision QA',
): ChatModelCapability {
  const model = requireChatModel(catalog, modelId);

  if (!model.supportsVision) {
    throw new ProviderCapabilityError(
      modelId,
      `this model does not accept image input, so it cannot be used for ${purpose}.`,
    );
  }

  return model;
}

export function requireImageModel(
  catalog: ModelCatalogPort,
  modelId: string,
): ImageModelCapability {
  const model = catalog.getImageModel(modelId);

  if (!model) {
    const available = catalog.listImageModels().map((item) => item.id);
    throw new ProviderCapabilityError(
      modelId,
      `unknown image model. Available models: ${available.join(', ') || 'none'}.`,
    );
  }

  return model;
}

export function requireVideoModel(
  catalog: ModelCatalogPort,
  modelId: string,
): VideoModelCapability {
  const model = catalog.getVideoModel(modelId);

  if (!model) {
    const available = catalog.listVideoModels().map((item) => item.id);
    throw new ProviderCapabilityError(
      modelId,
      `unknown video model. Available models: ${available.join(', ') || 'none'}.`,
    );
  }

  return model;
}
