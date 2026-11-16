import { describe, expect, it, vi } from 'vitest';
import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import { ProviderRequestError } from '@/domain/errors/domain-errors';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { OpenRouterClient } from '../openrouter-client';
import { OpenRouterVisionQaAdapter } from '../openrouter-vision-qa-adapter';

const visionModel: ChatModelCapability = {
  id: 'test/reasoning-vision',
  label: 'Reasoning Vision',
  provider: 'Test',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.4,
  supportsVision: true,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [visionModel],
  getChatModel: (modelId) =>
    modelId === visionModel.id ? visionModel : undefined,
  listImageModels: () => [],
  listVideoModels: () => [],
  getImageModel: () => undefined,
  getVideoModel: () => undefined,
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function createAdapter(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return new OpenRouterVisionQaAdapter({
    client: new OpenRouterClient({
      apiKey: 'test-key',
      mode: 'hybrid',
      fetchImpl: fetchMock,
    }),
    catalog,
  });
}

const qaInput = {
  originalProductUrl: 'data:image/png;base64,ZmFrZQ==',
  generatedKeyframeUrl: 'data:image/png;base64,Z2VuZXJhdGVk',
  originalPrompt: 'Hero packshot of the exact serum bottle.',
  productDna: 'Matte ceramic bottle with a brushed gold cap.',
  model: visionModel.id,
};

describe('OpenRouterVisionQaAdapter', () => {
  it('sends the QA reasoning effort and never caps max_tokens', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                fidelityScore: 9,
                defects: [],
                refinedPrompt: '',
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { cost: 0.001 },
        model: visionModel.id,
      }),
    );

    const output = await createAdapter(fetchMock).evaluateProductFidelity(
      qaInput,
    );
    const body = readBody(fetchMock.mock.calls[0]?.[1]);

    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body).not.toHaveProperty('max_tokens');
    expect(output.fidelityScore).toBe(9);
    expect(output.costUsd).toBe(0.001);
  });

  it('retries once with deterministic settings when the first response is not JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: { content: 'I can only describe the images in prose.' },
              finish_reason: 'stop',
            },
          ],
          usage: { cost: 0.0004 },
          model: visionModel.id,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  fidelityScore: 8,
                  defects: ['Minor label spacing drift'],
                  refinedPrompt: '',
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { cost: 0.0005 },
          model: visionModel.id,
        }),
      );

    const output = await createAdapter(fetchMock).evaluateProductFidelity(
      qaInput,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = readBody(fetchMock.mock.calls[0]?.[1]);
    const retryBody = readBody(fetchMock.mock.calls[1]?.[1]);
    expect(firstBody.temperature).toBe(0.1);
    expect(firstBody).not.toHaveProperty('max_tokens');
    expect(retryBody.temperature).toBe(0);
    expect(retryBody).not.toHaveProperty('max_tokens');
    expect(output.fidelityScore).toBe(8);
    expect(output.costUsd).toBeCloseTo(0.0009);
  });

  it('explains empty content when reasoning exhausted the token budget', async () => {
    const emptyResponse = () =>
      jsonResponse({
        choices: [
          {
            message: { content: null },
            finish_reason: 'length',
          },
        ],
        usage: {
          completion_tokens: 4096,
          completion_tokens_details: { reasoning_tokens: 4096 },
        },
      });

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(emptyResponse());

    const promise = createAdapter(fetchMock).evaluateProductFidelity(qaInput);

    await expect(promise).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(promise).rejects.toThrow(
      /after 2 attempts.*finish_reason: length, reasoning_tokens: 4096/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
