import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetStoragePort } from '@/domain/ports/media-ports';
import { sanitizeStorageFileName } from '@/infrastructure/assets/local-public-assets';
import { decodeBase64Image } from './base64-image';

export interface HybridLocalStorageAdapterOptions {
  publicRoot?: string;
}

/**
 * Offline fallback used when `BLOB_READ_WRITE_TOKEN` is missing. Hybrid mode
 * mocks video, so locally served keyframes are enough for previews. The saved
 * paths are ignored by Git and served by Next.js from `public/generated/`.
 */
export class HybridLocalStorageAdapter implements AssetStoragePort {
  private readonly publicRoot: string;

  constructor(options: HybridLocalStorageAdapterOptions = {}) {
    this.publicRoot = options.publicRoot ?? path.join(process.cwd(), 'public');
  }

  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    const decoded = decodeBase64Image(b64Json);
    const extension = decoded.extension;
    const safeFilename = sanitizeStorageFileName(filename, extension).replace(
      /\.[a-zA-Z0-9]+$/,
      `.${extension}`,
    );
    const generatedDirectory = path.join(this.publicRoot, 'generated');

    await mkdir(generatedDirectory, { recursive: true });
    await writeFile(path.join(generatedDirectory, safeFilename), decoded.bytes);

    return `/generated/${safeFilename}`;
  }

  async ensurePublicHttpsUrl(source: string, filename: string): Promise<string> {
    const trimmed = source.trim();

    if (/^https:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('data:')) {
      return this.savePublicImageFromBase64(trimmed, filename);
    }

    // Local fixtures stay locally served. Live video submission will reject
    // them with an actionable BLOB_READ_WRITE_TOKEN error.
    return trimmed;
  }
}
