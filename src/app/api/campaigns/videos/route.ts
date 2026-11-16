import type { NextRequest } from 'next/server';
import { submitVideosRequestSchema } from '@/application/dto/campaign-schemas';
import { resolveVideoDurationSeconds } from '@/application/services/video-duration';
import { SubmitVideosUseCase } from '@/application/use-cases/submit-videos';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import { resolveModelCatalog } from '@/infrastructure/openrouter/model-catalog';
import { jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const body = submitVideosRequestSchema.parse(await request.json());
    const { catalog } = await resolveModelCatalog();
    const providers = createMediaProviders(body.campaign.mode, { catalog });

    const useCase = new SubmitVideosUseCase({
      video: providers.video,
      storage: providers.storage,
      catalog,
    });

    const output = await useCase.execute({
      campaign: body.campaign,
      videoModel: body.videoModel,
      durationSeconds:
        body.durationSeconds ??
        resolveVideoDurationSeconds(catalog, body.videoModel),
    });

    return jsonOk(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
