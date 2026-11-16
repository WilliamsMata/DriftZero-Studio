import { describe, expect, it } from 'vitest';
import { DraftCreativeBriefUseCase } from '@/application/use-cases/draft-creative-brief';
import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import {
  BudgetGuardrailError,
  InvalidWorkflowStateError,
  ProviderCapabilityError,
} from '@/domain/errors/domain-errors';
import type {
  BriefDraftOutput,
  CreativeDirectorPort,
  DirectorOutput,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';

const textModel: ChatModelCapability = {
  id: 'test/text-model',
  label: 'Text Model',
  provider: 'Test',
  inputCostPerMillionUsd: 0.1,
  outputCostPerMillionUsd: 0.4,
  supportsVision: false,
};

const catalog: ModelCatalogPort = {
  listChatModels: () => [textModel],
  getChatModel: (modelId) => (modelId === textModel.id ? textModel : undefined),
  listImageModels: () => [],
  listVideoModels: () => [],
  getImageModel: () => undefined,
  getVideoModel: () => undefined,
};

const watchProduct = {
  name: 'Chronos Apex GT',
  category: 'Chronograph Watch',
  imageUrl: '/fixtures/watch-anchor.jpeg',
};

class FakeDirector implements CreativeDirectorPort {
  calls = 0;
  lastInput: Parameters<CreativeDirectorPort['draftBrief']>[0] | undefined;

  async draftBrief(
    input: Parameters<CreativeDirectorPort['draftBrief']>[0],
  ): Promise<BriefDraftOutput> {
    this.calls += 1;
    this.lastInput = input;

    return {
      brief:
        'Chronos Apex GT launch: midnight city precision story with tachymeter macro fidelity and controlled slow-motion moves.',
      costUsd: 0.0003,
      model: 'test/text-model',
    };
  }

  async planCampaign(): Promise<DirectorOutput> {
    throw new Error('planCampaign should not run while drafting a brief.');
  }
}

function createUseCase(director: CreativeDirectorPort): DraftCreativeBriefUseCase {
  return new DraftCreativeBriefUseCase({ director, catalog });
}

describe('DraftCreativeBriefUseCase', () => {
  it('drafts a text-only brief with the product and tone context', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    const result = await useCase.execute({
      product: watchProduct,
      tone: 'luxury-editorial',
      aspectRatio: '9:16',
      briefModel: textModel.id,
      shotCount: 3,
      maxBudgetUsd: 1.5,
    });

    expect(result.brief).toContain('Chronos Apex GT launch');
    expect(result.brief.length).toBeLessThanOrEqual(500);
    expect(director.calls).toBe(1);
    expect(director.lastInput).toMatchObject({
      product: watchProduct,
      tone: 'luxury-editorial',
      aspectRatio: '9:16',
      shotCount: 3,
      model: textModel.id,
    });
    expect(result.costUsd).toBe(0.0003);
  });

  it('accepts a text-only model because the brief never sends an image', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    await expect(
      useCase.execute({
        product: watchProduct,
        tone: 'minimalist-studio',
        aspectRatio: '1:1',
        briefModel: textModel.id,
        maxBudgetUsd: 1.5,
      }),
    ).resolves.toMatchObject({ model: textModel.id });

    expect(textModel.supportsVision).toBe(false);
    expect(director.calls).toBe(1);
  });

  it('rejects an unknown text model before calling the director', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    await expect(
      useCase.execute({
        product: watchProduct,
        tone: 'luxury-editorial',
        aspectRatio: '9:16',
        briefModel: 'unknown/model',
        maxBudgetUsd: 1.5,
      }),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);

    expect(director.calls).toBe(0);
  });

  it('rejects an out-of-range shot count before calling the director', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    await expect(
      useCase.execute({
        product: watchProduct,
        tone: 'luxury-editorial',
        aspectRatio: '9:16',
        briefModel: textModel.id,
        shotCount: 99,
        maxBudgetUsd: 1.5,
      }),
    ).rejects.toBeInstanceOf(InvalidWorkflowStateError);

    expect(director.calls).toBe(0);
  });

  it('reserves the call against the campaign budget before spending', async () => {
    const director = new FakeDirector();
    const useCase = createUseCase(director);

    await expect(
      useCase.execute({
        product: watchProduct,
        tone: 'luxury-editorial',
        aspectRatio: '9:16',
        briefModel: textModel.id,
        maxBudgetUsd: 0.00001,
      }),
    ).rejects.toBeInstanceOf(BudgetGuardrailError);

    expect(director.calls).toBe(0);
  });
});
