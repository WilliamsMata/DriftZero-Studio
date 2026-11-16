import { describe, expect, it } from 'vitest';
import { PlanCampaignUseCase } from '@/application/use-cases/plan-campaign';
import type {
  ChatModelCapability,
  ImageModelCapability,
  VideoModelCapability,
} from '@/domain/entities/model-capabilities';
import { ProviderCapabilityError } from '@/domain/errors/domain-errors';
import type {
  BriefDraftOutput,
  CreativeDirectorPort,
  DirectorOutput,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

const visionChatModel: ChatModelCapability = {
  id: 'test/vision-director',
  label: 'Vision Director',
  provider: 'Test',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.4,
  supportsVision: true,
};

const textOnlyChatModel: ChatModelCapability = {
  id: 'test/text-only-director',
  label: 'Text Only Director',
  provider: 'Test',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.4,
  supportsVision: false,
};

const imageModel: ImageModelCapability = {
  id: 'test/image-model',
  label: 'Test Image Model',
  provider: 'Test',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: true,
  maxInputReferences: 2,
  estimatedCostPerImageUsd: 0.02,
};

const videoModel: VideoModelCapability = {
  id: 'test/video-model',
  label: 'Test Video Model',
  provider: 'Test',
  supportedAspectRatios: ['9:16'],
  supportsInputReferences: false,
  maxInputReferences: 0,
  supportedDurations: [4],
  supportedResolutions: ['480p'],
  supportedFrameImages: ['first_frame'],
  supportsLastFrame: false,
  audioMode: 'none',
  estimatedCostPerSecondUsd: 0.02,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [visionChatModel, textOnlyChatModel],
  getChatModel: (modelId) => {
    if (modelId === visionChatModel.id) return visionChatModel;
    if (modelId === textOnlyChatModel.id) return textOnlyChatModel;
    return undefined;
  },
  listImageModels: () => [imageModel],
  getImageModel: (modelId) =>
    modelId === imageModel.id ? imageModel : undefined,
  listVideoModels: () => [videoModel],
  getVideoModel: (modelId) =>
    modelId === videoModel.id ? videoModel : undefined,
};

class FakeDirector implements CreativeDirectorPort {
  calls = 0;

  async draftBrief(): Promise<BriefDraftOutput> {
    return {
      brief:
        'Luxury fragrance launch with a golden-hour terrace narrative and macro label fidelity.',
      costUsd: 0,
      model: 'mock/brief-writer-v1',
    };
  }

  async planCampaign(): Promise<DirectorOutput> {
    this.calls += 1;

    return {
      productDna:
        'Faceted amber glass flacon with a brushed gold collar and burgundy label.',
      adCopy: {
        hook: 'Hook',
        headline: 'Headline',
        cta: 'CTA',
      },
      shots: [
        {
          index: 1,
          role: 'hero-packshot',
          title: 'Hero packshot',
          imagePrompt:
            'Studio hero shot of the exact flacon on warm travertine stone.',
          videoMotionPrompt: 'Slow orbit push-in.',
        },
        {
          index: 2,
          role: 'lifestyle-context',
          title: 'Lifestyle context',
          imagePrompt:
            'The exact flacon on a marble terrace at golden hour.',
          videoMotionPrompt: 'Gentle parallax drift.',
        },
        {
          index: 3,
          role: 'macro-finale',
          title: 'Macro finale',
          imagePrompt: 'Macro detail of the exact label and gold collar.',
          videoMotionPrompt: 'Smooth macro pull-back.',
        },
      ],
      costUsd: 0.001,
      model: visionChatModel.id,
    };
  }
}

function createUseCase(director: CreativeDirectorPort): PlanCampaignUseCase {
  return new PlanCampaignUseCase({ director, catalog });
}

describe('PlanCampaignUseCase', () => {
  it('rejects a text-only model before the director is called', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    await expect(
      useCase.execute({
        product: {
          name: 'Noir Oud',
          category: 'Luxury fragrance',
          imageUrl: '/fixtures/perfume-anchor.jpeg',
        },
        tone: 'luxury-editorial',
        aspectRatio: '9:16',
        textModel: textOnlyChatModel.id,
        imageModel: imageModel.id,
        videoModel: videoModel.id,
        maxBudgetUsd: 1.5,
      }),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);

    expect(director.calls).toBe(0);
  });

  it('returns the grounded productDna and shot blueprint from the director', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    const campaign = await useCase.execute({
      product: {
        name: 'Noir Oud',
        category: 'Luxury fragrance',
        imageUrl: '/fixtures/perfume-anchor.jpeg',
      },
      tone: 'luxury-editorial',
      aspectRatio: '9:16',
      textModel: visionChatModel.id,
      imageModel: imageModel.id,
      videoModel: videoModel.id,
      maxBudgetUsd: 1.5,
    });

    expect(director.calls).toBe(1);
    expect(campaign.productDna).toContain('Faceted amber glass flacon');
    expect(campaign.shots).toHaveLength(3);
    expect(campaign.results).toHaveLength(3);
    expect(campaign.results.every((result) => result.keyframeUrl === '')).toBe(
      true,
    );
  });
});
