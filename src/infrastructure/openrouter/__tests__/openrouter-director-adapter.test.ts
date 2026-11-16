import { describe, expect, it, vi } from 'vitest';
import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import {
  ProviderCapabilityError,
  ProviderRequestError,
} from '@/domain/errors/domain-errors';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import { OpenRouterClient } from '../openrouter-client';
import { OpenRouterDirectorAdapter } from '../openrouter-director-adapter';

const chatModel: ChatModelCapability = {
  id: 'test/reasoning-chat',
  label: 'Reasoning Chat',
  provider: 'Test',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.4,
  supportsVision: true,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [chatModel],
  getChatModel: (modelId) => (modelId === chatModel.id ? chatModel : undefined),
  listImageModels: () => [],
  listVideoModels: () => [],
  getImageModel: () => undefined,
  getVideoModel: () => undefined,
};

const validDirectorOutput = {
  productDna:
    'Matte ceramic serum bottle with a brushed gold cap and a serif label.',
  adCopy: {
    hook: 'Skin that speaks first.',
    headline: 'Silence, bottled.',
    cta: 'Discover the ritual',
  },
  shots: [
    {
      index: 1,
      role: 'hero-packshot',
      title: 'Hero packshot',
      imagePrompt:
        'Studio hero shot of the exact serum bottle on a warm stone plinth.',
      videoMotionPrompt: 'Slow orbit around the bottle, no object changes.',
    },
    {
      index: 2,
      role: 'lifestyle-context',
      title: 'Morning ritual',
      imagePrompt:
        'The exact serum bottle on a marble vanity in soft morning light.',
      videoMotionPrompt: 'Gentle dolly-in toward the bottle on the vanity.',
    },
    {
      index: 3,
      role: 'macro-finale',
      title: 'Label macro',
      imagePrompt:
        'Macro detail of the exact label text and brushed gold cap edge.',
      videoMotionPrompt: 'Slow rack focus along the label, no text changes.',
    },
  ],
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
  return new OpenRouterDirectorAdapter({
    client: new OpenRouterClient({
      apiKey: 'test-key',
      mode: 'hybrid',
      fetchImpl: fetchMock,
    }),
    catalog,
  });
}

const planInput = {
  product: {
    name: 'Noir Oud',
    category: 'luxury fragrance',
    imageUrl: '/fixtures/perfume-anchor.jpeg',
  },
  tone: 'luxury-editorial' as const,
  aspectRatio: '9:16' as const,
  shotCount: 3,
  userGoal: 'Launch a premium social ad.',
  model: chatModel.id,
};

describe('OpenRouterDirectorAdapter', () => {
  it('sends per-model reasoning effort and never caps max_tokens', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: { content: JSON.stringify(validDirectorOutput) },
            finish_reason: 'stop',
          },
        ],
        usage: { cost: 0.002 },
        model: chatModel.id,
      }),
    );

    const output = await createAdapter(fetchMock).planCampaign(planInput);
    const body = readBody(fetchMock.mock.calls[0]?.[1]);
    const messages = body.messages as Array<{
      role: string;
      content: unknown;
    }>;
    const userContent = messages[1]?.content as Array<{
      type: string;
      image_url?: { url: string };
    }>;

    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body).not.toHaveProperty('max_tokens');
    expect(body.temperature).toBe(0.4);
    expect(messages[1]?.role).toBe('user');
    expect(userContent[0]).toMatchObject({ type: 'text' });
    expect(userContent[1]).toMatchObject({
      type: 'image_url',
      image_url: {
        url: expect.stringMatching(/^data:image\/jpeg;base64,/),
      },
    });
    expect(output.shots).toHaveLength(3);
    expect(output.costUsd).toBe(0.002);
  });

  it('rejects a text-only director model before making a provider call', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const textOnlyCatalog: ModelCatalogPort = {
      ...catalog,
      listChatModels: () => [{ ...chatModel, supportsVision: false }],
      getChatModel: (modelId) =>
        modelId === chatModel.id
          ? { ...chatModel, supportsVision: false }
          : undefined,
    };

    const adapter = new OpenRouterDirectorAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'hybrid',
        fetchImpl: fetchMock,
      }),
      catalog: textOnlyCatalog,
    });

    await expect(adapter.planCampaign(planInput)).rejects.toBeInstanceOf(
      ProviderCapabilityError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drafts a text-only brief without sending the product anchor', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const textOnlyCatalog: ModelCatalogPort = {
      ...catalog,
      listChatModels: () => [
        { ...chatModel, supportsVision: false, reasoningEffort: 'high' },
      ],
      getChatModel: (modelId) =>
        modelId === chatModel.id
          ? { ...chatModel, supportsVision: false, reasoningEffort: 'high' }
          : undefined,
    };
    const brief =
      'Chronos Apex GT launch: midnight city precision story with tachymeter macro fidelity and controlled slow-motion moves.';

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: { content: JSON.stringify({ brief }) },
            finish_reason: 'stop',
          },
        ],
        usage: { cost: 0.0004 },
        model: chatModel.id,
      }),
    );

    const adapter = new OpenRouterDirectorAdapter({
      client: new OpenRouterClient({
        apiKey: 'test-key',
        mode: 'hybrid',
        fetchImpl: fetchMock,
      }),
      catalog: textOnlyCatalog,
    });

    const output = await adapter.draftBrief({
      product: {
        name: 'Chronos Apex GT',
        category: 'Chronograph Watch',
        imageUrl: '/fixtures/watch-anchor.jpeg',
      },
      tone: 'luxury-editorial',
      aspectRatio: '9:16',
      shotCount: 3,
      model: chatModel.id,
    });

    const body = readBody(fetchMock.mock.calls[0]?.[1]);
    const messages = body.messages as Array<{
      role: string;
      content: unknown;
    }>;

    expect(messages).toHaveLength(2);
    expect(messages[1]?.role).toBe('user');
    expect(typeof messages[1]?.content).toBe('string');
    expect(String(messages[1]?.content)).toContain('Chronos Apex GT');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.reasoning).toEqual({ effort: 'high' });
    expect(body).not.toHaveProperty('max_tokens');
    expect(output).toMatchObject({ brief, costUsd: 0.0004 });
  });

  it('clamps a verbose draft to the 500-character brief limit', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({ brief: 'A '.repeat(300) }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { cost: 0.0004 },
        model: chatModel.id,
      }),
    );

    const output = await createAdapter(fetchMock).draftBrief({
      product: {
        name: 'Chronos Apex GT',
        category: 'Chronograph Watch',
        imageUrl: '/fixtures/watch-anchor.jpeg',
      },
      tone: 'minimalist-studio',
      aspectRatio: '1:1',
      shotCount: 1,
      model: chatModel.id,
    });

    expect(output.brief.length).toBeLessThanOrEqual(500);
    expect(output.brief.endsWith(' ')).toBe(false);
  });

  it('explains empty content when reasoning exhausted the token budget', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
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
      }),
    );

    const promise = createAdapter(fetchMock).planCampaign(planInput);

    await expect(promise).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(promise).rejects.toThrow(
      /finish_reason: length, reasoning_tokens: 4096/,
    );
  });
});
