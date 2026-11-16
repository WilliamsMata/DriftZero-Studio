import type { NextRequest } from 'next/server';
import { generateKeyframesRequestSchema } from '@/application/dto/campaign-schemas';
import { GenerateKeyframesWithQaUseCase } from '@/application/use-cases/generate-keyframes-with-qa';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import {
  getDefaultVisionQaModelId,
  resolveModelCatalog,
} from '@/infrastructure/openrouter/model-catalog';
import { jsonOk, toErrorResponse } from '../../_lib/http';

/**
 * Keyframe requests are intentionally scoped to a subset of shots (normally
 * one) so a single invocation stays well below the hosting platform's maximum
 * function duration. The studio orchestrates the full batch client-side.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = generateKeyframesRequestSchema.parse(await request.json());
    const { catalog } = await resolveModelCatalog();
    const providers = createMediaProviders(body.campaign.mode, { catalog });

    const useCase = new GenerateKeyframesWithQaUseCase({
      image: providers.image,
      visionQa: providers.visionQa,
      storage: providers.storage,
      catalog,
    });

    const output = await useCase.execute({
      campaign: body.campaign,
      imageModel: body.imageModel,
      visionModel: body.visionModel ?? getDefaultVisionQaModelId(),
      maxRetries: body.maxRetries,
      shotIndexes: body.shotIndexes,
    });

    return jsonOk(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
