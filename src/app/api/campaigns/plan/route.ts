import type { NextRequest } from 'next/server';
import { planCampaignRequestSchema } from '@/application/dto/campaign-schemas';
import { DEFAULT_VIDEO_DURATION_SECONDS } from '@/application/services/media-constants';
import { PlanCampaignUseCase } from '@/application/use-cases/plan-campaign';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import { modelCatalog } from '@/infrastructure/openrouter/model-catalog';
import { getRequestedMode, jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const body = planCampaignRequestSchema.parse(await request.json());
    const requestedMode = body.mode ?? getRequestedMode(request);
    const providers = createMediaProviders(requestedMode);

    const useCase = new PlanCampaignUseCase({
      director: providers.director,
      catalog: modelCatalog,
    });

    const campaign = await useCase.execute({
      product: body.product,
      tone: body.tone,
      aspectRatio: body.aspectRatio,
      imageModel: body.imageModel,
      videoModel: body.videoModel,
      maxBudgetUsd: body.maxBudgetUsd,
      userGoal: body.userGoal,
      mode: providers.mode,
    });

    return jsonOk({
      campaign,
      selection: {
        imageModel: body.imageModel,
        videoModel: body.videoModel,
        durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
