import type { NextRequest } from 'next/server';
import { draftCreativeBriefRequestSchema } from '@/application/dto/campaign-schemas';
import { DraftCreativeBriefUseCase } from '@/application/use-cases/draft-creative-brief';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import {
  getDefaultBriefModelId,
  resolveModelCatalog,
} from '@/infrastructure/openrouter/model-catalog';
import { getRequestedMode, jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const body = draftCreativeBriefRequestSchema.parse(await request.json());
    const requestedMode = body.mode ?? getRequestedMode(request);
    const { catalog } = await resolveModelCatalog();
    const providers = createMediaProviders(requestedMode, { catalog });

    const useCase = new DraftCreativeBriefUseCase({
      director: providers.director,
      catalog,
    });

    const briefModel = getDefaultBriefModelId();
    const draft = await useCase.execute({
      product: body.product,
      tone: body.tone,
      aspectRatio: body.aspectRatio,
      briefModel,
      shotCount: body.shotCount,
      maxBudgetUsd: body.maxBudgetUsd,
    });

    return jsonOk(draft);
  } catch (error) {
    return toErrorResponse(error);
  }
}
