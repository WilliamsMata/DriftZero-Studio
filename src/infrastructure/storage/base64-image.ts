import { ProviderCapabilityError } from '@/domain/errors/domain-errors';

const MIME_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export interface DecodedBase64Image {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * OpenRouter's Image API can return JPEG bytes even when the caller does not
 * request a specific format. Detect the real type from the magic bytes so the
 * saved filename, served Content-Type, and Vision QA data URI all agree.
 */
export function detectImageContentType(
  bytes: Buffer,
  fallback = 'image/png',
): string {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      bytes.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif';
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('ascii'))
  ) {
    return 'image/avif';
  }

  return normalizeMimeType(fallback);
}

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  return MIME_EXTENSION[normalized] !== undefined ? normalized : 'image/png';
}

/**
 * Accepts either a bare base64 payload (OpenRouter Image API) or a full
 * `data:image/...;base64,` URI (upload route). Invalid payloads are rejected
 * before they reach blob storage.
 */
export function decodeBase64Image(
  b64Json: string,
  fallbackMimeType = 'image/png',
): DecodedBase64Image {
  const trimmed = b64Json.trim();

  if (trimmed === '') {
    throw new ProviderCapabilityError(
      'assets/storage',
      'the image provider returned an empty base64 payload.',
    );
  }

  let contentType = normalizeMimeType(fallbackMimeType);
  let payload = trimmed;

  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');

    if (commaIndex === -1) {
      throw new ProviderCapabilityError(
        'assets/storage',
        'the image data URI is missing its base64 payload.',
      );
    }

    const metadata = trimmed.slice('data:'.length, commaIndex);
    const declaredMime = metadata.split(';')[0] ?? '';

    if (!metadata.toLowerCase().includes(';base64')) {
      throw new ProviderCapabilityError(
        'assets/storage',
        'only base64-encoded image data URIs are supported.',
      );
    }

    contentType = normalizeMimeType(declaredMime);
    payload = trimmed.slice(commaIndex + 1);
  }

  const compactPayload = payload.replace(/\s+/g, '');

  if (compactPayload === '' || !/^[A-Za-z0-9+/=_-]+$/.test(compactPayload)) {
    throw new ProviderCapabilityError(
      'assets/storage',
      'the image payload is not valid base64 data.',
    );
  }

  const bytes = Buffer.from(compactPayload, 'base64');

  if (bytes.byteLength === 0) {
    throw new ProviderCapabilityError(
      'assets/storage',
      'the decoded image payload is empty.',
    );
  }

  // Trust the bytes over the declared MIME type: providers may return JPEG
  // bytes for a payload that was requested (or assumed) as PNG.
  const detectedContentType = detectImageContentType(bytes, contentType);

  return {
    bytes,
    contentType: detectedContentType,
    extension: MIME_EXTENSION[detectedContentType] ?? 'png',
  };
}
