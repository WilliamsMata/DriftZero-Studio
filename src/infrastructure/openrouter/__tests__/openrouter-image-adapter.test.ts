import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageModelCapability } from '@/domain/entities/model-capabilities';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { OpenRouterClient } from '../openrouter-client';
import { OpenRouterImageAdapter } from '../openrouter-image-adapter';

const referenceImageModel: ImageModelCapability = {
  id: 'test/image-with-references',
  label: 'Reference Image Model',
  provider: 'Test',
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  supportsInputReferences: true,
  maxInputReferences: 2,
  estimatedCostPerImageUsd: 0.039,
};

const textOnlyImageModel: ImageModelCapability = {
  ...referenceImageModel,
  id: 'test/image-text-only',
  supportsInputReferences: false,
  maxInputReferences: 0,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [],
  getChatModel: () => undefined,
  listImageModels: () => [referenceImageModel, textOnlyImageModel],
  listVideoModels: () => [],
  getImageModel: (modelId) =>
    [referenceImageModel, textOnlyImageModel].find(
      (model) => model.id === modelId,
    ),
  getVideoModel: () => undefined,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('OpenRouterImageAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends input_references in OpenRouter format and decodes b64_json + usage.cost', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ b64_json: 'ZmFrZS1pbWFnZQ==', media_type: 'image/png' }],
        usage: { cost: 0.0315 },
      }),
    );

    const adapter = new OpenRouterImageAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'live',
        fetchImpl: fetchMock,
      }),
      catalog,
    });

    const output = await adapter.generateKeyframe({
      prompt: 'Editorial hero packshot',
      referenceImageUrls: [
        'https://cdn.example.com/product-anchor.png',
        'https://cdn.example.com/secondary.png',
        'https://cdn.example.com/ignored-over-limit.png',
      ],
      aspectRatio: '9:16',
      model: referenceImageModel.id,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/images');

    const body = readBody(init);
    expect(body.model).toBe(referenceImageModel.id);
    expect(body.prompt).toBe('Editorial hero packshot');
    expect(body.aspect_ratio).toBe('9:16');
    expect(body.n).toBe(1);
    expect(body.input_references).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://cdn.example.com/product-anchor.png' },
      },
      {
        type: 'image_url',
        image_url: { url: 'https://cdn.example.com/secondary.png' },
      },
    ]);

    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-key');
    expect(headers.get('X-Title')).toBe('DriftZero Studio');

    expect(output.b64Json).toBe('ZmFrZS1pbWFnZQ==');
    expect(output.mediaType).toBe('image/png');
    expect(output.costUsd).toBe(0.0315);
    expect(output.model).toBe(referenceImageModel.id);
  });

  it('omits input_references when the model does not support them', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ b64_json: 'ZmFrZQ==' }] }),
    );

    const adapter = new OpenRouterImageAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'live',
        fetchImpl: fetchMock,
      }),
      catalog,
    });

    await adapter.generateKeyframe({
      prompt: 'Text only poster',
      referenceImageUrls: ['https://cdn.example.com/product-anchor.png'],
      aspectRatio: '1:1',
      model: textOnlyImageModel.id,
    });

    const body = readBody(fetchMock.mock.calls[0]?.[1]);
    expect(body.input_references).toBeUndefined();
  });

  it('falls back to the model estimate when usage.cost is absent', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ b64_json: 'ZmFrZQ==' }] }),
    );

    const adapter = new OpenRouterImageAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'live',
        fetchImpl: fetchMock,
      }),
      catalog,
    });

    const output = await adapter.generateKeyframe({
      prompt: 'Studio packshot',
      referenceImageUrls: [],
      aspectRatio: '9:16',
      model: referenceImageModel.id,
    });

    expect(output.costUsd).toBe(referenceImageModel.estimatedCostPerImageUsd);
  });
});
