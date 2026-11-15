import type { NextRequest } from 'next/server';
import { submitVideosRequestSchema } from '@/application/dto/campaign-schemas';
import { SubmitVideosUseCase } from '@/application/use-cases/submit-videos';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import { modelCatalog } from '@/infrastructure/openrouter/model-catalog';
import { jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const body = submitVideosRequestSchema.parse(await request.json());
    const providers = createMediaProviders(body.campaign.mode);

    const useCase = new SubmitVideosUseCase({
      video: providers.video,
      catalog: modelCatalog,
    });

    const output = await useCase.execute({
      campaign: body.campaign,
      videoModel: body.videoModel,
      durationSeconds: body.durationSeconds,
    });

    return jsonOk(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
