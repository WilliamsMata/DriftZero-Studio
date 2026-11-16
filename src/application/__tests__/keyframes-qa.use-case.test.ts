import { describe, expect, it } from 'vitest';
import { MAX_VISION_QA_RETRIES } from '@/application/services/media-constants';
import { GenerateKeyframesWithQaUseCase } from '@/application/use-cases/generate-keyframes-with-qa';
import type {
  CampaignState,
  ShotPlan,
} from '@/domain/entities/campaign';
import type {
  ChatModelCapability,
  ImageModelCapability,
} from '@/domain/entities/model-capabilities';
import type {
  AssetStoragePort,
  ImageGenOutput,
  ImageGenPort,
  VisionQaOutput,
  VisionQaPort,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

const imageModel: ImageModelCapability = {
  id: 'test/image-model',
  label: 'Test Image Model',
  provider: 'Test Provider',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: true,
  maxInputReferences: 2,
  estimatedCostPerImageUsd: 0.039,
};

const visionModel: ChatModelCapability = {
  id: 'test/vision-model',
  label: 'Test Vision Model',
  provider: 'Test Provider',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.2,
  supportsVision: true,
};

const shots: ShotPlan[] = [
  {
    index: 1,
    role: 'hero-packshot',
    title: 'Hero',
    imagePrompt: 'Shot 1 (hero-packshot): studio product hero',
    videoMotionPrompt: 'Push in',
  },
  {
    index: 2,
    role: 'lifestyle-context',
    title: 'Lifestyle',
    imagePrompt: 'Shot 2 (lifestyle-context): product on a terrace',
    videoMotionPrompt: 'Parallax drift',
  },
  {
    index: 3,
    role: 'macro-finale',
    title: 'Macro',
    imagePrompt: 'Shot 3 (macro-finale): label macro',
    videoMotionPrompt: 'Pull back',
  },
];

function createCampaign(): CampaignState {
  return {
    id: 'test-campaign',
    mode: 'mock',
    aspectRatio: '9:16',
    tone: 'luxury-editorial',
    product: {
      name: 'Test Serum',
      category: 'Skincare',
      imageUrl: '/fixtures/perfume-anchor.jpeg',
    },
    productDna: 'Amber glass bottle with exact label preservation.',
    adCopy: {
      hook: 'Test hook',
      headline: 'Test headline',
      cta: 'Test CTA',
    },
    shots,
    results: shots.map((shot) => ({
      shotIndex: shot.index,
      keyframeUrl: '',
      fidelityScore: 0,
      qaFeedback: '',
      wasRetried: false,
      videoStatus: 'idle',
      videoProgress: 0,
    })),
    ledger: {
      totalUsd: 0,
      maxBudgetUsd: 1.5,
      entries: [],
    },
  };
}

const catalog: ModelCatalogPort = {
  listChatModels: () => [visionModel],
  getChatModel: (modelId) =>
    modelId === visionModel.id ? visionModel : undefined,
  listImageModels: () => [imageModel],
  listVideoModels: () => [],
  getImageModel: (modelId) =>
    modelId === imageModel.id ? imageModel : undefined,
  getVideoModel: () => undefined,
};

class FakeImageAdapter implements ImageGenPort {
  readonly prompts: string[] = [];

  async generateKeyframe(
    input: Parameters<ImageGenPort['generateKeyframe']>[0],
  ): Promise<ImageGenOutput> {
    this.prompts.push(input.prompt);
    return {
      publicUrl: `/fixtures/generated-${this.prompts.length}.jpeg`,
      costUsd: 0.039,
      model: input.model,
    };
  }
}

class TrackingImageAdapter implements ImageGenPort {
  active = 0;
  maxActive = 0;
  calls = 0;

  async generateKeyframe(
    input: Parameters<ImageGenPort['generateKeyframe']>[0],
  ): Promise<ImageGenOutput> {
    this.active += 1;
    this.calls += 1;
    this.maxActive = Math.max(this.maxActive, this.active);

    await new Promise((resolve) => setTimeout(resolve, 5));

    this.active -= 1;
    return {
      publicUrl: `/fixtures/generated-${this.calls}.jpeg`,
      costUsd: 0.039,
      model: input.model,
    };
  }
}

class AlwaysLowVisionQaAdapter implements VisionQaPort {
  calls = 0;

  async evaluateProductFidelity(
    input: Parameters<VisionQaPort['evaluateProductFidelity']>[0],
  ): Promise<VisionQaOutput> {
    this.calls += 1;
    return {
      fidelityScore: 4,
      defects: ['Label text softened'],
      refinedPrompt: `${input.originalPrompt}, razor sharp product typography and exact label preservation`,
      costUsd: 0.001,
      model: 'test/vision-qa',
    };
  }
}

class HighFidelityVisionQaAdapter implements VisionQaPort {
  calls = 0;

  async evaluateProductFidelity(): Promise<VisionQaOutput> {
    this.calls += 1;
    return {
      fidelityScore: 9,
      defects: [],
      refinedPrompt: '',
      costUsd: 0.001,
      model: 'test/vision-qa',
    };
  }
}

class FakeStorageAdapter implements AssetStoragePort {
  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    void b64Json;
    void filename;
    return '/fixtures/oud-perfume/shot-1.jpeg';
  }

  async ensurePublicHttpsUrl(source: string): Promise<string> {
    return source;
  }
}

describe('GenerateKeyframesWithQaUseCase', () => {
  it('retries exactly once when fidelity stays below 7 and then stops', async () => {
    expect(MAX_VISION_QA_RETRIES).toBe(1);

    const image = new FakeImageAdapter();
    const visionQa = new AlwaysLowVisionQaAdapter();
    const useCase = new GenerateKeyframesWithQaUseCase({
      image,
      visionQa,
      storage: new FakeStorageAdapter(),
      catalog,
    });

    const output = await useCase.execute({
      campaign: createCampaign(),
      imageModel: imageModel.id,
      visionModel: visionModel.id,
      maxRetries: 1,
    });

    // 3 shots x (initial + one retry) = 6 image generations.
    expect(image.prompts).toHaveLength(6);
    expect(visionQa.calls).toBe(6);

    // Every prompt must carry the product identity block and frame policy.
    expect(image.prompts[0]).toContain(
      'Amber glass bottle with exact label preservation.',
    );
    expect(image.prompts[0]).toContain('NON-NEGOTIABLE FIDELITY RULES');
    expect(image.prompts[0]).toContain('FRAME: vertical 9:16 frame');

    // The retry prompts must carry the refinement guidance and QA defects.
    const refinedPrompts = image.prompts.filter((prompt) =>
      prompt.includes('razor sharp product typography'),
    );
    expect(refinedPrompts).toHaveLength(3);
    expect(
      refinedPrompts.every((prompt) =>
        prompt.includes('CORRECTIONS REQUIRED FROM PRODUCT-FIDELITY QA'),
      ),
    ).toBe(true);
    expect(
      refinedPrompts.every((prompt) =>
        prompt.includes('Label text softened'),
      ),
    ).toBe(true);

    expect(output.results).toHaveLength(3);
    expect(
      output.results.every((result) =>
        result.imagePromptUsed?.includes(
          'Amber glass bottle with exact label preservation.',
        ),
      ),
    ).toBe(true);
    expect(output.results.every((result) => result.wasRetried)).toBe(true);
    expect(output.results.every((result) => result.fidelityScore === 4)).toBe(
      true,
    );

    // Even though the score remains < 7, a second retry is forbidden.
    expect(image.prompts).toHaveLength(6);
    expect(visionQa.calls).toBe(6);

    expect(output.ledger.entries.filter((entry) => entry.step === 'image')).toHaveLength(
      6,
    );
    expect(
      output.ledger.entries.filter((entry) => entry.step === 'vision-qa'),
    ).toHaveLength(6);
    expect(output.ledger.totalUsd).toBeLessThan(output.ledger.maxBudgetUsd);
  });

  it('does not retry when the first fidelity score already passes', async () => {
    const image = new FakeImageAdapter();
    const visionQa = new HighFidelityVisionQaAdapter();
    const useCase = new GenerateKeyframesWithQaUseCase({
      image,
      visionQa,
      storage: new FakeStorageAdapter(),
      catalog,
    });

    const output = await useCase.execute({
      campaign: createCampaign(),
      imageModel: imageModel.id,
      visionModel: visionModel.id,
    });

    expect(image.prompts).toHaveLength(3);
    expect(image.prompts[0]).toContain(
      'Amber glass bottle with exact label preservation.',
    );
    expect(image.prompts[0]).toContain('NON-NEGOTIABLE FIDELITY RULES');
    expect(visionQa.calls).toBe(3);
    expect(output.results.every((result) => result.wasRetried)).toBe(false);
    expect(output.results.every((result) => result.fidelityScore === 9)).toBe(
      true,
    );
  });

  it('generates only the requested shot and preserves the other results', async () => {
    const image = new FakeImageAdapter();
    const visionQa = new HighFidelityVisionQaAdapter();
    const useCase = new GenerateKeyframesWithQaUseCase({
      image,
      visionQa,
      storage: new FakeStorageAdapter(),
      catalog,
    });

    const campaign = createCampaign();
    campaign.results[0] = {
      ...campaign.results[0],
      keyframeUrl: '/generated/existing-shot-1.jpeg',
      fidelityScore: 8,
      qaFeedback: 'Previously generated.',
    };

    const output = await useCase.execute({
      campaign,
      imageModel: imageModel.id,
      visionModel: visionModel.id,
      maxRetries: 1,
      shotIndexes: [2],
    });

    expect(image.prompts).toHaveLength(1);
    expect(image.prompts[0]).toContain('Shot 2 (lifestyle-context)');
    expect(output.results).toHaveLength(3);
    expect(output.results[0]?.keyframeUrl).toBe(
      '/generated/existing-shot-1.jpeg',
    );
    expect(output.results[1]?.keyframeUrl).toBe('/fixtures/generated-1.jpeg');
    expect(output.results[2]?.keyframeUrl).toBe('');
    expect(output.campaign.results).toHaveLength(3);
    expect(
      output.ledger.entries.filter((entry) => entry.step === 'image'),
    ).toHaveLength(1);
  });

  it('rejects shot indexes that are not part of the campaign', async () => {
    const useCase = new GenerateKeyframesWithQaUseCase({
      image: new FakeImageAdapter(),
      visionQa: new HighFidelityVisionQaAdapter(),
      storage: new FakeStorageAdapter(),
      catalog,
    });

    await expect(
      useCase.execute({
        campaign: createCampaign(),
        imageModel: imageModel.id,
        visionModel: visionModel.id,
        shotIndexes: [4],
      }),
    ).rejects.toThrow(/not part of this campaign/);
  });

  it('runs the initial keyframe wave in parallel', async () => {
    const image = new TrackingImageAdapter();
    const visionQa = new HighFidelityVisionQaAdapter();
    const useCase = new GenerateKeyframesWithQaUseCase({
      image,
      visionQa,
      storage: new FakeStorageAdapter(),
      catalog,
    });

    await useCase.execute({
      campaign: createCampaign(),
      imageModel: imageModel.id,
      visionModel: visionModel.id,
    });

    expect(image.calls).toBe(3);
    expect(image.maxActive).toBeGreaterThan(1);
  });
});
