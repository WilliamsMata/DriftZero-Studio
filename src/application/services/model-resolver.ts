import type {
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

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
