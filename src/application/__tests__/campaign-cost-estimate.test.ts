import { describe, expect, it } from 'vitest';
import {
  estimatePlanCostUsd,
  estimateVisionQaCostUsd,
} from '@/application/services/chat-cost-estimator';
import { resolveVideoDurationSeconds } from '@/application/services/video-duration';
import type {
  ChatModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  applyExecutionModeToEstimate,
  estimateCampaignCostUsd,
  getDurationSliderConfig,
  snapDurationSeconds,
} from '@/lib/studio-utils';

const chatModel: ChatModelCapability = {
  id: 'test/chat-model',
  label: 'Test Chat',
  provider: 'Test',
  inputCostPerMillionUsd: 0.0507,
  outputCostPerMillionUsd: 0.2028,
  supportsVision: true,
};

const heyGen: VideoModelCapability = {
  id: 'test/heygen',
  label: 'HeyGen Test',
  provider: 'Test',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: false,
  maxInputReferences: 0,
  supportedDurations: [5, 6, 7, 8, 9, 10],
  supportedResolutions: ['480p'],
  supportedFrameImages: ['first_frame'],
  supportsLastFrame: false,
  estimatedCostPerSecondUsd: 0.02,
};

const veo: VideoModelCapability = {
  ...heyGen,
  id: 'test/veo',
  label: 'Veo Test',
  supportedDurations: [4, 6, 8],
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [chatModel],
  getChatModel: (modelId) =>
    modelId === chatModel.id ? chatModel : undefined,
  listImageModels: () => [],
  getImageModel: () => undefined,
  listVideoModels: () => [heyGen],
  getVideoModel: (modelId) =>
    modelId === heyGen.id ? heyGen : undefined,
};

describe('campaign cost estimates', () => {
  it('estimates the default text and vision calls from model pricing', () => {
    expect(estimatePlanCostUsd(chatModel)).toBe(0.000608);
    expect(estimateVisionQaCostUsd(chatModel)).toBe(0.000284);
  });

  it('combines text, vision, image, and video costs with a retry worst case', () => {
    const estimate = estimateCampaignCostUsd({
      planCostUsd: 0.000608,
      visionQaCostPerCallUsd: 0.000284,
      imageCostPerImageUsd: 0.041,
      videoCostPerSecondUsd: 0.02,
      durationSeconds: 5,
    });

    expect(estimate.visionQaUsd).toBeCloseTo(0.000852, 6);
    expect(estimate.imageUsd).toBeCloseTo(0.123, 6);
    expect(estimate.videoUsd).toBeCloseTo(0.3, 6);
    expect(estimate.totalUsd).toBeCloseTo(0.42446, 6);
    expect(estimate.worstCaseTotalUsd).toBeCloseTo(0.548312, 6);
  });

  it('scales every media line with the selected shot count', () => {
    const fiveShots = estimateCampaignCostUsd({
      planCostUsd: 0.001,
      visionQaCostPerCallUsd: 0.001,
      imageCostPerImageUsd: 0.01,
      videoCostPerSecondUsd: 0.02,
      durationSeconds: 5,
      shotCount: 5,
    });

    expect(fiveShots.visionQaUsd).toBeCloseTo(0.005, 6);
    expect(fiveShots.imageUsd).toBeCloseTo(0.05, 6);
    expect(fiveShots.videoUsd).toBeCloseTo(0.5, 6);
    expect(fiveShots.totalUsd).toBeCloseTo(0.556, 6);
  });

  it('zeros mock, excludes video in hybrid, and keeps everything in live', () => {
    const estimate = estimateCampaignCostUsd({
      planCostUsd: 0.001,
      visionQaCostPerCallUsd: 0.001,
      imageCostPerImageUsd: 0.01,
      videoCostPerSecondUsd: 0.02,
      durationSeconds: 5,
    });

    expect(applyExecutionModeToEstimate(estimate, 'mock').totalUsd).toBe(0);

    const hybrid = applyExecutionModeToEstimate(estimate, 'hybrid');
    expect(hybrid.videoUsd).toBe(0);
    expect(hybrid.totalUsd).toBeCloseTo(estimate.totalUsd - estimate.videoUsd, 6);

    expect(applyExecutionModeToEstimate(estimate, 'live')).toEqual(estimate);
  });

  it('picks the first supported duration when the default 4s is unavailable', () => {
    expect(resolveVideoDurationSeconds(catalog, heyGen.id)).toBe(5);
  });

  it('builds a slider that only lands on supported durations', () => {
    expect(getDurationSliderConfig(heyGen)).toMatchObject({
      min: 5,
      max: 10,
      step: 1,
    });
    expect(getDurationSliderConfig(veo)).toMatchObject({
      min: 4,
      max: 8,
      step: 2,
    });
    expect(snapDurationSeconds(9, [4, 6, 8])).toBe(8);
  });
});
