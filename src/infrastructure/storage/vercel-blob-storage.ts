import { put } from '@vercel/blob';
import { ProviderConfigurationError } from '@/domain/errors/domain-errors';
import type { AssetStoragePort } from '@/domain/ports/media-ports';
import {
  readLocalPublicAsset,
  sanitizeStorageFileName,
} from '@/infrastructure/assets/local-public-assets';
import { decodeBase64Image } from './base64-image';

export interface VercelBlobStorageAdapterOptions {
  token?: string;
}

/**
 * Public HTTPS storage for live mode. OpenRouter's Video API requires frame
 * images to be public HTTPS URLs returning `200 OK`, and the Vercel Blob CDN
 * satisfies that without exposing the studio server.
 */
export class VercelBlobStorageAdapter implements AssetStoragePort {
  private readonly explicitToken?: string;

  constructor(options: VercelBlobStorageAdapterOptions = {}) {
    this.explicitToken = options.token?.trim();
  }

  private requireToken(): string {
    const token =
      this.explicitToken !== undefined && this.explicitToken !== ''
        ? this.explicitToken
        : process.env.BLOB_READ_WRITE_TOKEN?.trim();

    if (token === undefined || token === '') {
      throw new ProviderConfigurationError(
        'Vercel Blob',
        'BLOB_READ_WRITE_TOKEN',
        'Live video frame hosting requires public HTTPS URLs.',
      );
    }

    return token;
  }

  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    const decoded = decodeBase64Image(b64Json);
    // Use the MIME type detected from the bytes, not a hardcoded PNG guess:
    // OpenRouter's Image API may return JPEG even for a bare base64 payload.
    const contentType = decoded.contentType;
    const extension = decoded.extension;
    const safeFilename = sanitizeStorageFileName(filename, extension).replace(
      /\.[a-zA-Z0-9]+$/,
      `.${extension}`,
    );
    const pathname = `generated/${safeFilename}`;

    const blob = await put(pathname, decoded.bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token: this.requireToken(),
    });

    return blob.url;
  }

  /**
   * Uploads a local `/fixtures/...` or `/generated/...` file to Vercel Blob.
   * Used when a live video job starts from a local preset anchor or a
   * hybrid-mode local keyframe.
   */
  async uploadLocalPublicAsset(
    source: string,
    filename: string,
  ): Promise<string> {
    const asset = await readLocalPublicAsset(source);
    const pathname = `campaign-assets/${sanitizeStorageFileName(
      filename,
      asset.extension,
    )}`;

    const blob = await put(pathname, asset.bytes, {
      access: 'public',
      contentType: asset.contentType,
      addRandomSuffix: true,
      token: this.requireToken(),
    });

    return blob.url;
  }

  async ensurePublicHttpsUrl(source: string, filename: string): Promise<string> {
    const trimmed = source.trim();

    if (/^https:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('data:')) {
      return this.savePublicImageFromBase64(trimmed, filename);
    }

    return this.uploadLocalPublicAsset(trimmed, filename);
  }
}
