import { describe, expect, it } from 'vitest';
import { AssetResolutionError } from '@/domain/errors/domain-errors';
import { resolveLocalAssetToDataUri } from '../openrouter-client';

describe('resolveLocalAssetToDataUri', () => {
  it('reads a public fixture from disk and returns an image data URI', async () => {
    const dataUri = await resolveLocalAssetToDataUri(
      '/fixtures/perfume-anchor.jpeg',
    );

    expect(dataUri.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(dataUri.length).toBeGreaterThan(100);
  });

  it('keeps remote HTTPS URLs and existing data URIs unchanged', async () => {
    await expect(
      resolveLocalAssetToDataUri('https://cdn.example.com/anchor.png'),
    ).resolves.toBe('https://cdn.example.com/anchor.png');

    const existing = 'data:image/png;base64,ZmFrZQ==';
    await expect(resolveLocalAssetToDataUri(existing)).resolves.toBe(existing);
  });

  it('rejects path traversal and unsupported browser URLs', async () => {
    await expect(
      resolveLocalAssetToDataUri('/fixtures/../.env'),
    ).rejects.toBeInstanceOf(AssetResolutionError);

    await expect(
      resolveLocalAssetToDataUri('blob:http://localhost:3000/abc'),
    ).rejects.toBeInstanceOf(AssetResolutionError);
  });
});
