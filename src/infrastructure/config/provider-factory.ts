import type { ExecutionMode } from '@/domain/entities/campaign';
import {
  MockAssetStorageAdapter,
  MockDirectorAdapter,
  MockImageAdapter,
  MockVideoAdapter,
  MockVisionQaAdapter,
} from '../mocks/mock-adapters';

export function getExecutionMode(override?: ExecutionMode): ExecutionMode {
  if (override) return override;
  const envMode = process.env.MEDIA_EXECUTION_MODE;
  if (envMode === 'hybrid' || envMode === 'live') return envMode;
  return 'mock';
}

export function createMediaProviders(overrideMode?: ExecutionMode) {
  const mode = getExecutionMode(overrideMode);

  // Phase 1 routes every provider to Mock. Phase 2/3 will wire OpenRouter adapters here.
  if (mode === 'mock') {
    return {
      mode,
      director: new MockDirectorAdapter(),
      image: new MockImageAdapter(),
      visionQa: new MockVisionQaAdapter(),
      video: new MockVideoAdapter(),
      storage: new MockAssetStorageAdapter(),
    };
  }

  // Temporary fallback until the OpenRouter adapters land in Phase 2.
  return {
    mode,
    director: new MockDirectorAdapter(),
    image: new MockImageAdapter(),
    visionQa: new MockVisionQaAdapter(),
    video: new MockVideoAdapter(),
    storage: new MockAssetStorageAdapter(),
  };
}
