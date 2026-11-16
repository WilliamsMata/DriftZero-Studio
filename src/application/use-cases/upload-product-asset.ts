import type { ExecutionMode } from '@/domain/entities/campaign';
import { AssetUploadError } from '@/domain/errors/domain-errors';
import type { AssetStoragePort } from '@/domain/ports/media-ports';

// Vercel Functions reject request bodies above 4.5 MB. A 3 MB image becomes
// ~4 MB as base64 when mock/hybrid campaigns carry it in the JSON payload, so
// this cap keeps every request inside the platform limit.
export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
};

export type UploadedAssetStorage = 'data-uri' | 'public-url' | 'local-path';

export interface UploadProductAssetInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Base64 payload without the `data:` prefix. */
  base64Data: string;
  mode: ExecutionMode;
  /**
   * Persist the anchor even outside `live` mode. Used when a public store
   * (Vercel Blob) is configured: deployed `hybrid` runs cannot keep a data URI
   * in the campaign payload because it would exceed the request body limit and
   * would not be readable by the provider.
   */
  persistPublicly?: boolean;
}

export interface UploadProductAssetOutput {
  imageUrl: string;
  storage: UploadedAssetStorage;
  bytes: number;
  fileName: string;
}

export interface UploadProductAssetDependencies {
  storage: AssetStoragePort;
}

function classifyUrl(url: string): UploadedAssetStorage {
  if (url.startsWith('data:')) return 'data-uri';
  if (/^https:\/\//i.test(url)) return 'public-url';
  return 'local-path';
}

function resolveExtension(contentType: string): string {
  return ALLOWED_CONTENT_TYPES[contentType] ?? 'png';
}

function sanitizeUploadName(fileName: string, extension: string): string {
  const baseName = fileName.trim().replace(/\.[a-zA-Z0-9]+$/, '');
  const safeStem = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 100);

  return `${safeStem === '' ? 'product-anchor' : safeStem}.${extension}`;
}

/**
 * Normalizes a browser-uploaded product anchor.
 *
 * - `mock`, and `hybrid` without a public store: returns a data URI so local
 *   runs need no deployment.
 * - `live`, or `hybrid` with `persistPublicly`: persists through
 *   `AssetStoragePort` so OpenRouter and the browser receive a public HTTPS
 *   URL (Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set).
 */
export class UploadProductAssetUseCase {
  constructor(private readonly dependencies: UploadProductAssetDependencies) {}

  async execute(
    input: UploadProductAssetInput,
  ): Promise<UploadProductAssetOutput> {
    const contentType = input.contentType.trim().toLowerCase();

    if (ALLOWED_CONTENT_TYPES[contentType] === undefined) {
      throw new AssetUploadError(
        'Upload a PNG, JPEG, or WebP product image.',
        'unsupported-content-type',
      );
    }

    if (
      !Number.isFinite(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > MAX_PRODUCT_IMAGE_BYTES
    ) {
      throw new AssetUploadError(
        `Product images must be between 1 byte and ${Math.floor(
          MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024),
        )} MB.`,
        'invalid-size',
      );
    }

    const compactBase64 = input.base64Data.replace(/\s+/g, '');

    if (
      compactBase64 === '' ||
      !/^[A-Za-z0-9+/=_-]+$/.test(compactBase64)
    ) {
      throw new AssetUploadError(
        'The uploaded product image is not valid base64 data.',
        'invalid-payload',
      );
    }

    const padding = compactBase64.endsWith('==')
      ? 2
      : compactBase64.endsWith('=')
        ? 1
        : 0;
    const decodedBytes =
      Math.floor((compactBase64.length * 3) / 4) - padding;

    if (decodedBytes <= 0 || decodedBytes > MAX_PRODUCT_IMAGE_BYTES) {
      throw new AssetUploadError(
        `Product images must be between 1 byte and ${Math.floor(
          MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024),
        )} MB.`,
        'invalid-size',
      );
    }

    const fileName = sanitizeUploadName(
      input.fileName,
      resolveExtension(contentType),
    );
    const normalizedContentType =
      contentType === 'image/jpg' ? 'image/jpeg' : contentType;
    const dataUri = `data:${normalizedContentType};base64,${compactBase64}`;

    if (input.mode !== 'live' && input.persistPublicly !== true) {
      return {
        imageUrl: dataUri,
        storage: 'data-uri',
        bytes: decodedBytes,
        fileName,
      };
    }

    const imageUrl = await this.dependencies.storage.ensurePublicHttpsUrl(
      dataUri,
      fileName,
    );

    return {
      imageUrl,
      storage: classifyUrl(imageUrl),
      bytes: decodedBytes,
      fileName,
    };
  }
}
