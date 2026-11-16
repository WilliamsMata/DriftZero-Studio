import { z } from 'zod';
import type { ImageModelCapability } from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type { ImageGenOutput, ImageGenPort } from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { modelCatalog } from './model-catalog';
import {
  OpenRouterClient,
  resolveLocalAssetToDataUri,
} from './openrouter-client';

const imageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z.string().min(1),
        media_type: z.string().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      cost: z.number().nonnegative().optional(),
    })
    .optional(),
  model: z.string().optional(),
});

export interface OpenRouterImageAdapterOptions {
  client?: OpenRouterClient;
  catalog?: ModelCatalogPort;
}

interface ImageReference {
  type: 'image_url';
  image_url: { url: string };
}

export class OpenRouterImageAdapter implements ImageGenPort {
  private readonly client: OpenRouterClient;
  private readonly catalog: ModelCatalogPort;

  constructor(options: OpenRouterImageAdapterOptions = {}) {
    this.client = options.client ?? new OpenRouterClient({ mode: 'live' });
    this.catalog = options.catalog ?? modelCatalog;
  }

  async generateKeyframe(
    input: Parameters<ImageGenPort['generateKeyframe']>[0],
  ): Promise<ImageGenOutput> {
    const model = this.resolveModel(input.model);
    const referenceImages = await this.resolveReferenceImages(
      input.referenceImageUrls,
      model,
    );

    const requestBody: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      n: 1,
    };

    if (referenceImages.length > 0) {
      requestBody.input_references = referenceImages;
    }

    const rawResponse = await this.client.requestJson<unknown>(
      '/images',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      120_000,
    );

    const response = imageResponseSchema.parse(rawResponse);
    const image = response.data[0];

    if (!image) {
      throw new ProviderCapabilityError(
        input.model,
        'the image provider returned no image payload.',
      );
    }

    return {
      b64Json: image.b64_json,
      mediaType: image.media_type,
      costUsd:
        response.usage?.cost !== undefined
          ? response.usage.cost
          : model.estimatedCostPerImageUsd,
      model: response.model ?? input.model,
    };
  }

  private resolveModel(modelId: string): ImageModelCapability {
    const model = this.catalog.getImageModel(modelId);

    if (!model) {
      throw new ProviderCapabilityError(
        modelId,
        'unknown image model. Reload the capability catalog and pick a supported model.',
      );
    }

    return model;
  }

  private async resolveReferenceImages(
    referenceImageUrls: string[],
    model: ImageModelCapability,
  ): Promise<ImageReference[]> {
    if (
      referenceImageUrls.length === 0 ||
      !model.supportsInputReferences ||
      model.maxInputReferences < 1
    ) {
      return [];
    }

    const acceptedReferences = referenceImageUrls.slice(
      0,
      model.maxInputReferences,
    );

    const resolvedUrls = await Promise.all(
      acceptedReferences.map((reference) => resolveLocalAssetToDataUri(reference)),
    );

    return resolvedUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url },
    }));
  }
}
