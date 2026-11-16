import type { NextRequest } from 'next/server';
import { planCampaignRequestSchema } from '@/application/dto/campaign-schemas';
import { resolveVideoDurationSeconds } from '@/application/services/video-duration';
import { PlanCampaignUseCase } from '@/application/use-cases/plan-campaign';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import {
  getDefaultTextModelId,
  resolveModelCatalog,
} from '@/infrastructure/openrouter/model-catalog';
import { getRequestedMode, jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const body = planCampaignRequestSchema.parse(await request.json());
    const requestedMode = body.mode ?? getRequestedMode(request);
    const { catalog } = await resolveModelCatalog();
    const providers = createMediaProviders(requestedMode, { catalog });

    const useCase = new PlanCampaignUseCase({
      director: providers.director,
      catalog,
    });

    const textModel = body.textModel ?? getDefaultTextModelId();
    const durationSeconds =
      body.durationSeconds ??
      resolveVideoDurationSeconds(catalog, body.videoModel);

    const campaign = await useCase.execute({
      product: body.product,
      tone: body.tone,
      aspectRatio: body.aspectRatio,
      textModel,
      imageModel: body.imageModel,
      videoModel: body.videoModel,
      shotCount: body.shotCount,
      durationSeconds,
      maxBudgetUsd: body.maxBudgetUsd,
      userGoal: body.userGoal,
      mode: providers.mode,
    });

    return jsonOk({
      campaign,
      selection: {
        textModel,
        imageModel: body.imageModel,
        videoModel: body.videoModel,
        shotCount: body.shotCount,
        durationSeconds,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
