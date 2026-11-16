import { describe, expect, it } from 'vitest';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  UploadProductAssetUseCase,
} from '@/application/use-cases/upload-product-asset';
import { AssetUploadError } from '@/domain/errors/domain-errors';
import type { AssetStoragePort } from '@/domain/ports/media-ports';

class FakeStorageAdapter implements AssetStoragePort {
  ensureCalls: string[] = [];

  async savePublicImageFromBase64(
    b64Json: string,
    filename: string,
  ): Promise<string> {
    void b64Json;
    return `https://blob.example.com/generated/${filename}`;
  }

  async ensurePublicHttpsUrl(source: string, filename: string): Promise<string> {
    void source;
    this.ensureCalls.push(filename);
    return `https://blob.example.com/campaign-assets/${filename}`;
  }
}

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('UploadProductAssetUseCase', () => {
  it('returns a data URI for mock and hybrid runs without touching storage', async () => {
    const storage = new FakeStorageAdapter();
    const useCase = new UploadProductAssetUseCase({ storage });

    const output = await useCase.execute({
      fileName: 'my product.png',
      contentType: 'image/png',
      sizeBytes: 68,
      base64Data: PNG_BASE64,
      mode: 'hybrid',
    });

    expect(output.storage).toBe('data-uri');
    expect(output.imageUrl).toBe(`data:image/png;base64,${PNG_BASE64}`);
    expect(storage.ensureCalls).toHaveLength(0);
  });

  it('persists live uploads through AssetStoragePort and returns a public URL', async () => {
    const storage = new FakeStorageAdapter();
    const useCase = new UploadProductAssetUseCase({ storage });

    const output = await useCase.execute({
      fileName: 'product photo.png',
      contentType: 'image/png',
      sizeBytes: 68,
      base64Data: PNG_BASE64,
      mode: 'live',
    });

    expect(output.storage).toBe('public-url');
    expect(output.imageUrl).toBe(
      'https://blob.example.com/campaign-assets/product-photo.png',
    );
    expect(storage.ensureCalls).toEqual(['product-photo.png']);
  });

  it('rejects unsupported formats and oversized uploads', async () => {
    const storage = new FakeStorageAdapter();
    const useCase = new UploadProductAssetUseCase({ storage });

    await expect(
      useCase.execute({
        fileName: 'product.svg',
        contentType: 'image/svg+xml',
        sizeBytes: 100,
        base64Data: 'ZmFrZQ==',
        mode: 'mock',
      }),
    ).rejects.toBeInstanceOf(AssetUploadError);

    await expect(
      useCase.execute({
        fileName: 'huge.png',
        contentType: 'image/png',
        sizeBytes: MAX_PRODUCT_IMAGE_BYTES + 1,
        base64Data: PNG_BASE64,
        mode: 'mock',
      }),
    ).rejects.toBeInstanceOf(AssetUploadError);
  });
});
