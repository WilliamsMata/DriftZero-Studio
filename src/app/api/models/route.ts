import { DEFAULT_VIDEO_DURATION_SECONDS } from '@/application/services/media-constants';
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  modelCatalog,
} from '@/infrastructure/openrouter/model-catalog';
import { jsonOk } from '../_lib/http';

export async function GET() {
  return jsonOk({
    imageModels: modelCatalog.listImageModels(),
    videoModels: modelCatalog.listVideoModels(),
    defaults: {
      imageModel: DEFAULT_IMAGE_MODEL_ID,
      videoModel: DEFAULT_VIDEO_MODEL_ID,
      aspectRatio: '9:16',
      durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
      maxBudgetUsd: 1.5,
    },
  });
}
