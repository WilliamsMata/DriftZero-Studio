import { describe, expect, it, vi } from 'vitest';
import type { VideoModelCapability } from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { OpenRouterClient } from '../openrouter-client';
import { OpenRouterVideoAdapter } from '../openrouter-video-adapter';

const videoModel: VideoModelCapability = {
  id: 'test/video-model',
  label: 'Test Video Model',
  provider: 'Test',
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  supportsInputReferences: true,
  maxInputReferences: 4,
  supportedDurations: [4, 5],
  supportedResolutions: ['720p', '480p', '1080p'],
  supportedFrameImages: ['first_frame', 'last_frame'],
  supportsLastFrame: true,
  audioMode: 'optional',
  estimatedCostPerSecondUsd: 0.03,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [],
  getChatModel: () => undefined,
  listImageModels: () => [],
  listVideoModels: () => [videoModel],
  getImageModel: () => undefined,
  getVideoModel: (modelId) =>
    modelId === videoModel.id ? videoModel : undefined,
};

function jsonResponse(payload: unknown, status = 202): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function createAdapter(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return new OpenRouterVideoAdapter({
    client: new OpenRouterClient({
      apiKey: 'test-key',
      mode: 'live',
      fetchImpl: fetchMock,
    }),
    catalog,
  });
}

describe('OpenRouterVideoAdapter', () => {
  it('requests audio when the model supports the flag and formats frame_images', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'job-123' }));

    const adapter = createAdapter(fetchMock);

    const submission = await adapter.submitImageToVideo({
      prompt: 'Slow cinematic orbit',
      firstFrameUrl: 'https://blob.example.com/first.png',
      lastFrameUrl: 'https://blob.example.com/last.png',
      aspectRatio: '9:16',
      durationSeconds: 4,
      model: videoModel.id,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/videos');

    const body = readBody(init);
    expect(body.model).toBe(videoModel.id);
    expect(body.aspect_ratio).toBe('9:16');
    expect(body.duration).toBe(4);
    expect(body.generate_audio).toBe(true);
    // 480p is the cost-safe tier even though the model lists 720p first.
    expect(body.resolution).toBe('480p');
    expect(body.frame_images).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://blob.example.com/first.png' },
        frame_type: 'first_frame',
      },
      {
        type: 'image_url',
        image_url: { url: 'https://blob.example.com/last.png' },
        frame_type: 'last_frame',
      },
    ]);

    expect(submission.jobId).toBe('job-123');
    expect(submission.estimatedCostUsd).toBe(0.12);
  });

  it('omits generate_audio for models that cannot toggle audio', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'job-789' }));

    const alwaysAudioModel: VideoModelCapability = {
      ...videoModel,
      id: 'test/always-audio-model',
      audioMode: 'always',
    };

    const adapter = new OpenRouterVideoAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'live',
        fetchImpl: fetchMock,
      }),
      catalog: {
        ...catalog,
        listVideoModels: () => [alwaysAudioModel],
        getVideoModel: (modelId) =>
          modelId === alwaysAudioModel.id ? alwaysAudioModel : undefined,
      },
    });

    await adapter.submitImageToVideo({
      prompt: 'Always-on audio track',
      firstFrameUrl: 'https://blob.example.com/first.png',
      aspectRatio: '9:16',
      durationSeconds: 4,
      model: alwaysAudioModel.id,
    });

    const body = readBody(fetchMock.mock.calls[0]?.[1]);
    expect(Object.hasOwn(body, 'generate_audio')).toBe(false);
  });

  it('omits last_frame when the model does not support it', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'job-456' }));

    const firstFrameOnly: VideoModelCapability = {
      ...videoModel,
      supportedFrameImages: ['first_frame'],
      supportsLastFrame: false,
    };

    const adapter = new OpenRouterVideoAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'live',
        fetchImpl: fetchMock,
      }),
      catalog: {
        ...catalog,
        listVideoModels: () => [firstFrameOnly],
        getVideoModel: (modelId) =>
          modelId === firstFrameOnly.id ? firstFrameOnly : undefined,
      },
    });

    await adapter.submitImageToVideo({
      prompt: 'Handheld drift',
      firstFrameUrl: 'https://blob.example.com/first.png',
      lastFrameUrl: 'https://blob.example.com/last.png',
      aspectRatio: '9:16',
      durationSeconds: 4,
      model: firstFrameOnly.id,
    });

    const body = readBody(fetchMock.mock.calls[0]?.[1]);
    expect(body.frame_images).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://blob.example.com/first.png' },
        frame_type: 'first_frame',
      },
    ]);
  });

  it('maps pending -> queued, in_progress -> processing, completed -> completed', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'pending' }, 200))
      .mockResolvedValueOnce(jsonResponse({ status: 'in_progress' }, 200))
      .mockResolvedValueOnce(
        jsonResponse(
          { status: 'completed', usage: { cost: 0.2 } },
          200,
        ),
      );

    const adapter = createAdapter(fetchMock);

    const pending = await adapter.getJobStatus('job-123');
    expect(pending).toMatchObject({
      status: 'queued',
      progress: 20,
    });

    const processing = await adapter.getJobStatus('job-123');
    expect(processing).toMatchObject({
      status: 'processing',
      progress: 65,
    });

    const completed = await adapter.getJobStatus('job-123');
    expect(completed).toEqual({
      jobId: 'job-123',
      status: 'completed',
      progress: 100,
      playbackUrl: '/api/videos/job-123/content',
      actualCostUsd: 0.2,
    });

    const pollUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(pollUrls).toEqual([
      'https://openrouter.ai/api/v1/videos/job-123',
      'https://openrouter.ai/api/v1/videos/job-123',
      'https://openrouter.ai/api/v1/videos/job-123',
    ]);
  });

  it('maps cancelled and expired jobs to failed with the provider message', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            status: 'cancelled',
            error: { message: 'Job was cancelled' },
          },
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { status: 'expired', error: 'Job exceeded maximum time to live' },
          200,
        ),
      );

    const adapter = createAdapter(fetchMock);

    await expect(adapter.getJobStatus('job-1')).resolves.toMatchObject({
      status: 'failed',
      errorMessage: 'Job was cancelled',
    });

    await expect(adapter.getJobStatus('job-2')).resolves.toMatchObject({
      status: 'failed',
      errorMessage: 'Job exceeded maximum time to live',
    });
  });

  it('rejects non-HTTPS first frames with an actionable BLOB_READ_WRITE_TOKEN error', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const adapter = createAdapter(fetchMock);

    const action = () =>
      adapter.submitImageToVideo({
        prompt: 'Push in',
        firstFrameUrl: '/fixtures/perfume-anchor.jpeg',
        aspectRatio: '9:16',
        durationSeconds: 4,
        model: videoModel.id,
      });

    await expect(action()).rejects.toBeInstanceOf(ProviderCapabilityError);
    await expect(action()).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
