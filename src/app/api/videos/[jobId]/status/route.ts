import type { NextRequest } from 'next/server';
import { videoStatusQuerySchema } from '@/application/dto/campaign-schemas';
import { PollVideoJobUseCase } from '@/application/use-cases/poll-video-job';
import { createMediaProviders } from '@/infrastructure/config/provider-factory';
import { jsonOk, toErrorResponse } from '../../../_lib/http';

interface VideoStatusRouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(
  request: NextRequest,
  context: VideoStatusRouteContext,
) {
  try {
    const { jobId } = await context.params;
    const { mode } = videoStatusQuerySchema.parse({
      mode: request.nextUrl.searchParams.get('mode') ?? undefined,
    });
    const providers = createMediaProviders(mode);

    const useCase = new PollVideoJobUseCase({
      video: providers.video,
    });

    const status = await useCase.execute(jobId);

    return jsonOk({ status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
