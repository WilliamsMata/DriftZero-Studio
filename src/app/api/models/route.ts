import type { NextRequest } from 'next/server';
import {
  estimatePlanCostUsd,
  estimateVisionQaCostUsd,
} from '@/application/services/chat-cost-estimator';
import { resolveDurationForModel } from '@/application/services/video-duration';
import {
  getDefaultImageModelId,
  getDefaultTextModelId,
  getDefaultVideoModelId,
  getDefaultVisionQaModelId,
  resolveModelCatalog,
} from '@/infrastructure/openrouter/model-catalog';
import { jsonOk } from '../_lib/http';

export async function GET(request: NextRequest) {
  const refreshParam = request.nextUrl.searchParams.get('refresh');
  const refresh = refreshParam === 'true' || refreshParam === '1';

  const { snapshot, source, refreshedAt } = await resolveModelCatalog({
    refresh,
  });

  // The creative director receives the product anchor image, so every text
  // model offered for planning must accept image input.
  const textModels = snapshot.chatModels
    .filter((model) => model.supportsVision)
    .map((model) => ({
      ...model,
      estimatedCostPerPlanUsd: estimatePlanCostUsd(model),
      estimatedCostPerQaUsd: estimateVisionQaCostUsd(model),
    }));

  const visionModels = snapshot.chatModels
    .filter((model) => model.supportsVision)
    .map((model) => ({
      ...model,
      estimatedCostPerPlanUsd: estimatePlanCostUsd(model),
      estimatedCostPerQaUsd: estimateVisionQaCostUsd(model),
    }));

  const defaultVideoModel = getDefaultVideoModelId();
  const defaultVideoCapability = snapshot.videoModels.find(
    (model) => model.id === defaultVideoModel,
  );

  return jsonOk({
    textModels,
    visionModels,
    imageModels: snapshot.imageModels,
    videoModels: snapshot.videoModels,
    defaults: {
      textModel: getDefaultTextModelId(),
      visionModel: getDefaultVisionQaModelId(),
      imageModel: getDefaultImageModelId(),
      videoModel: defaultVideoModel,
      aspectRatio: '9:16',
      durationSeconds: resolveDurationForModel(defaultVideoCapability),
      maxBudgetUsd: 1.5,
    },
    catalog: {
      source,
      refreshedAt,
    },
  });
}
