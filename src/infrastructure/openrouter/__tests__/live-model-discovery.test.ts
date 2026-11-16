import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import type { ModelsSnapshot } from '../model-catalog';
import { fetchLiveModelsSnapshot } from '../live-model-discovery';

const imageModel: ImageModelCapability = {
  id: 'test/image-model',
  label: 'Test Image',
  provider: 'Test',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: true,
  maxInputReferences: 2,
  estimatedCostPerImageUsd: 0.01,
};

const videoModel: VideoModelCapability = {
  id: 'test/video-model',
  label: 'Test Video',
  provider: 'Test',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: false,
  maxInputReferences: 0,
  supportedDurations: [4],
  supportedResolutions: ['480p'],
  supportedFrameImages: ['first_frame'],
  supportsLastFrame: false,
  estimatedCostPerSecondUsd: 0.1,
};

const base: ModelsSnapshot = {
  chatModels: [
    {
      id: 'test/chat-model',
      label: 'Test Chat',
      provider: 'Test',
      inputCostPerMillionUsd: 0.1,
      outputCostPerMillionUsd: 0.2,
      supportsVision: true,
    },
  ],
  imageModels: [imageModel],
  videoModels: [videoModel],
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchLiveModelsSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tolerates null capability arrays and merges live pricing without dropping snapshot metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.endsWith('/images/models')) {
        return jsonResponse({
          data: [
            {
              id: imageModel.id,
              name: null,
              supported_parameters: null,
            },
          ],
        });
      }

      if (url.endsWith('/videos/models')) {
        return jsonResponse({
          data: [
            {
              id: videoModel.id,
              name: null,
              supported_resolutions: null,
              supported_aspect_ratios: null,
              supported_durations: null,
              supported_frame_images: null,
              pricing_skus: null,
            },
          ],
        });
      }

      if (url.endsWith(`/images/models/${imageModel.id}/endpoints`)) {
        return jsonResponse({
          endpoints: [
            {
              pricing: [
                {
                  billable: 'output_image',
                  unit: 'image',
                  cost_usd: 0.02,
                },
              ],
            },
          ],
        });
      }

      throw new Error(`Unexpected catalog URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLiveModelsSnapshot(base);

    expect(snapshot.imageModels[0]?.estimatedCostPerImageUsd).toBe(0.02);
    expect(snapshot.imageModels[0]?.maxInputReferences).toBe(2);
    expect(snapshot.videoModels[0]).toEqual(videoModel);
    expect(snapshot.chatModels).toEqual(base.chatModels);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
