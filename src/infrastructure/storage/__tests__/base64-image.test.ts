import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeBase64Image } from '../base64-image';
import { HybridLocalStorageAdapter } from '../hybrid-local-storage';

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('decodeBase64Image', () => {
  it('detects JPEG bytes from a bare base64 payload', () => {
    const decoded = decodeBase64Image(JPEG_BYTES.toString('base64'));

    expect(decoded.contentType).toBe('image/jpeg');
    expect(decoded.extension).toBe('jpeg');
  });

  it('trusts magic bytes over a mismatched data URI label', () => {
    const decoded = decodeBase64Image(
      `data:image/png;base64,${JPEG_BYTES.toString('base64')}`,
    );

    expect(decoded.contentType).toBe('image/jpeg');
    expect(decoded.extension).toBe('jpeg');
  });

  it('detects PNG bytes', () => {
    const decoded = decodeBase64Image(PNG_BYTES.toString('base64'));

    expect(decoded.contentType).toBe('image/png');
    expect(decoded.extension).toBe('png');
  });
});

describe('HybridLocalStorageAdapter', () => {
  it('saves bare JPEG base64 with a matching .jpeg extension', async () => {
    const publicRoot = await mkdtemp(path.join(tmpdir(), 'driftzero-storage-'));
    temporaryDirectories.push(publicRoot);

    const adapter = new HybridLocalStorageAdapter({ publicRoot });
    const url = await adapter.savePublicImageFromBase64(
      JPEG_BYTES.toString('base64'),
      'campaign-shot-1-initial.png',
    );

    expect(url).toBe('/generated/campaign-shot-1-initial.jpeg');
    const savedBytes = await readFile(
      path.join(publicRoot, 'generated', 'campaign-shot-1-initial.jpeg'),
    );
    expect(savedBytes.equals(JPEG_BYTES)).toBe(true);
  });
});
