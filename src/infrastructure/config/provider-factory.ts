import type { ExecutionMode } from '@/domain/entities/campaign';
import type {
  AssetStoragePort,
  CreativeDirectorPort,
  ImageGenPort,
  VideoGenPort,
  VisionQaPort,
} from '@/domain/ports/media-ports';
import type { ModelCatalogPort } from '@/domain/ports/model-catalog-port';
import {
  MockAssetStorageAdapter,
  MockDirectorAdapter,
  MockImageAdapter,
  MockVideoAdapter,
  MockVisionQaAdapter,
} from '../mocks/mock-adapters';
import { modelCatalog } from '../openrouter/model-catalog';
import { OpenRouterClient } from '../openrouter/openrouter-client';
import { OpenRouterDirectorAdapter } from '../openrouter/openrouter-director-adapter';
import { OpenRouterImageAdapter } from '../openrouter/openrouter-image-adapter';
import { OpenRouterVideoAdapter } from '../openrouter/openrouter-video-adapter';
import { OpenRouterVisionQaAdapter } from '../openrouter/openrouter-vision-qa-adapter';
import { HybridLocalStorageAdapter } from '../storage/hybrid-local-storage';
import { VercelBlobStorageAdapter } from '../storage/vercel-blob-storage';

export interface MediaProviders {
  mode: ExecutionMode;
  director: CreativeDirectorPort;
  image: ImageGenPort;
  visionQa: VisionQaPort;
  video: VideoGenPort;
  storage: AssetStoragePort;
}

export function getExecutionMode(override?: ExecutionMode): ExecutionMode {
  if (override) return override;
  const envMode = process.env.MEDIA_EXECUTION_MODE;
  if (envMode === 'hybrid' || envMode === 'live') return envMode;
  return 'mock';
}

export function hasBlobStorageToken(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token !== undefined && token !== '';
}

function createAssetStorage(): AssetStoragePort {
  return hasBlobStorageToken()
    ? new VercelBlobStorageAdapter()
    : new HybridLocalStorageAdapter();
}

export interface CreateMediaProvidersOptions {
  /** Catalog resolved by the route so live capability refresh also drives adapters. */
  catalog?: ModelCatalogPort;
}

export function createMediaProviders(
  overrideMode?: ExecutionMode,
  options: CreateMediaProvidersOptions = {},
): MediaProviders {
  const mode = getExecutionMode(overrideMode);

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

  const client = new OpenRouterClient({ mode });
  const storage = createAssetStorage();
  const catalog = options.catalog ?? modelCatalog;

  if (mode === 'hybrid') {
    return {
      mode,
      director: new OpenRouterDirectorAdapter({ client, catalog }),
      image: new OpenRouterImageAdapter({ client, catalog }),
      visionQa: new OpenRouterVisionQaAdapter({ client, catalog }),
      // Video stays mocked in hybrid mode so only LLM + image credits burn.
      video: new MockVideoAdapter(),
      storage,
    };
  }

  return {
    mode,
    director: new OpenRouterDirectorAdapter({ client, catalog }),
    image: new OpenRouterImageAdapter({ client, catalog }),
    visionQa: new OpenRouterVisionQaAdapter({ client, catalog }),
    video: new OpenRouterVideoAdapter({ client, catalog }),
    storage,
  };
}
