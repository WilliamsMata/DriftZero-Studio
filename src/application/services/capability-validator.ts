import type { AspectRatio } from '@/domain/entities/campaign';
import type {
  ImageModelCapability,
  VideoDurationSeconds,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';

export interface ImageRequestValidation {
  model: ImageModelCapability;
  aspectRatio: AspectRatio;
  referenceCount: number;
}

export interface VideoRequestValidation {
  model: VideoModelCapability;
  aspectRatio: AspectRatio;
  durationSeconds: VideoDurationSeconds;
  hasLastFrame: boolean;
}

function assertAspectRatio(
  model: Pick<ImageModelCapability, 'id' | 'supportedAspectRatios'>,
  aspectRatio: AspectRatio,
): void {
  if (!model.supportedAspectRatios.includes(aspectRatio)) {
    throw new ProviderCapabilityError(
      model.id,
      `aspect ratio "${aspectRatio}" is not supported. Supported ratios: ${model.supportedAspectRatios.join(
        ', ',
      )}.`,
    );
  }
}

export function validateImageRequest({
  model,
  aspectRatio,
  referenceCount,
}: ImageRequestValidation): void {
  assertAspectRatio(model, aspectRatio);

  if (!Number.isInteger(referenceCount) || referenceCount < 0) {
    throw new ProviderCapabilityError(
      model.id,
      'reference count must be a non-negative integer.',
    );
  }

  if (referenceCount > 0 && !model.supportsInputReferences) {
    throw new ProviderCapabilityError(
      model.id,
      'input references are not supported, but a product anchor was supplied.',
    );
  }

  if (referenceCount > model.maxInputReferences) {
    throw new ProviderCapabilityError(
      model.id,
      `received ${referenceCount} input reference(s), but the model accepts at most ${model.maxInputReferences}.`,
    );
  }
}

export function validateVideoRequest({
  model,
  aspectRatio,
  durationSeconds,
  hasLastFrame,
}: VideoRequestValidation): void {
  assertAspectRatio(model, aspectRatio);

  if (!model.supportedDurations.includes(durationSeconds)) {
    throw new ProviderCapabilityError(
      model.id,
      `duration ${durationSeconds}s is not supported. Supported durations: ${model.supportedDurations
        .map((duration) => `${duration}s`)
        .join(', ')}.`,
    );
  }

  if (hasLastFrame && !model.supportsLastFrame) {
    throw new ProviderCapabilityError(
      model.id,
      'last-frame conditioning is not supported by this model.',
    );
  }
}
