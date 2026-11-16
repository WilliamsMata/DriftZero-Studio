import { describe, expect, it } from 'vitest';
import {
  validateImageRequest,
  validateVideoRequest,
} from '@/application/services/capability-validator';
import type {
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';

const imageModel: ImageModelCapability = {
  id: 'test/image-model',
  label: 'Test Image Model',
  provider: 'Test Provider',
  supportedAspectRatios: ['9:16', '16:9'],
  supportsInputReferences: true,
  maxInputReferences: 2,
  estimatedCostPerImageUsd: 0.01,
};

const videoModelWithoutLastFrame: VideoModelCapability = {
  id: 'test/video-model-no-last-frame',
  label: 'Test Video Model',
  provider: 'Test Provider',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: false,
  maxInputReferences: 0,
  supportedDurations: [4],
  supportedResolutions: ['480p', '720p'],
  supportedFrameImages: ['first_frame'],
  supportsLastFrame: false,
  estimatedCostPerSecondUsd: 0.05,
};

const videoModelWithLastFrame: VideoModelCapability = {
  ...videoModelWithoutLastFrame,
  id: 'test/video-model-with-last-frame',
  supportedFrameImages: ['first_frame', 'last_frame'],
  supportsLastFrame: true,
};

describe('capability validator', () => {
  it('rejects a last frame when the video model does not support last-frame conditioning', () => {
    const action = () =>
      validateVideoRequest({
        model: videoModelWithoutLastFrame,
        aspectRatio: '9:16',
        durationSeconds: 4,
        hasLastFrame: true,
      });

    expect(action).toThrow(ProviderCapabilityError);

    try {
      action();
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderCapabilityError);

      if (error instanceof ProviderCapabilityError) {
        expect(error.modelId).toBe(videoModelWithoutLastFrame.id);
        expect(error.reason).toContain('last-frame conditioning');
      }
    }

    expect(() =>
      validateVideoRequest({
        model: videoModelWithLastFrame,
        aspectRatio: '9:16',
        durationSeconds: 4,
        hasLastFrame: true,
      }),
    ).not.toThrow();
  });

  it('rejects unsupported aspect ratios for image and video requests', () => {
    expect(() =>
      validateImageRequest({
        model: imageModel,
        aspectRatio: '1:1',
        referenceCount: 1,
      }),
    ).toThrow(ProviderCapabilityError);

    expect(() =>
      validateVideoRequest({
        model: videoModelWithLastFrame,
        aspectRatio: '16:9',
        durationSeconds: 4,
        hasLastFrame: false,
      }),
    ).toThrow(ProviderCapabilityError);
  });

  it('rejects unsupported durations and too many input references', () => {
    expect(() =>
      validateVideoRequest({
        model: videoModelWithLastFrame,
        aspectRatio: '9:16',
        durationSeconds: 5,
        hasLastFrame: false,
      }),
    ).toThrow(ProviderCapabilityError);

    expect(() =>
      validateImageRequest({
        model: imageModel,
        aspectRatio: '9:16',
        referenceCount: 3,
      }),
    ).toThrow(ProviderCapabilityError);
  });

  it('accepts valid image and video requests', () => {
    expect(() =>
      validateImageRequest({
        model: imageModel,
        aspectRatio: '9:16',
        referenceCount: 1,
      }),
    ).not.toThrow();

    expect(() =>
      validateVideoRequest({
        model: videoModelWithoutLastFrame,
        aspectRatio: '9:16',
        durationSeconds: 4,
        hasLastFrame: false,
      }),
    ).not.toThrow();
  });
});
