import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AssetResolutionError } from '@/domain/errors/domain-errors';

/**
 * Server-side helpers for images that live in the repository's `public/`
 * folder (fixtures and hybrid-mode generated assets). Browser URLs such as
 * `/fixtures/perfume-anchor.jpeg` only exist once the app is deployed, so
 * provider calls must read the bytes from disk instead.
 */

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const ALLOWED_PUBLIC_ROOTS = ['fixtures', 'generated'] as const;

export interface LocalPublicAsset {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

function normalizeExtension(extension: string): string {
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

export function getImageContentType(
  fileNameOrUrl: string,
  fallback = 'image/png',
): string {
  const withoutQuery = fileNameOrUrl.split(/[?#]/)[0] ?? '';
  const extension = withoutQuery.split('.').pop() ?? '';
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? fallback;
}

/**
 * Produces a filesystem-safe filename. Existing image extensions are kept so
 * the stored blob's extension matches its bytes.
 */
export function sanitizeStorageFileName(
  fileName: string,
  fallbackExtension = 'png',
): string {
  const baseName = path.basename(fileName.trim()).replace(/\s+/g, '-');
  const extensionMatch = /\.([a-zA-Z0-9]{1,8})$/.exec(baseName);
  const rawExtension =
    extensionMatch?.[1]?.toLowerCase() ?? normalizeExtension(fallbackExtension);
  const extension = MIME_BY_EXTENSION[rawExtension] ? rawExtension : 'png';
  const stem = (
    extensionMatch ? baseName.slice(0, -extensionMatch[0].length) : baseName
  )
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 100);

  return `${stem === '' ? 'asset' : stem}.${extension}`;
}

/**
 * Returns the repository-relative path (`fixtures/...`) for local references,
 * or `null` for remote/data URLs the provider can already read.
 */
export function extractLocalPublicPath(reference: string): string | null {
  const trimmed = reference.trim();

  if (trimmed === '' || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return null;
  }

  let pathname: string;

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }

    const isLoopback =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    if (!isLoopback) return null;

    pathname = decodeURIComponent(parsed.pathname);
  } else {
    const withoutQuery = trimmed.split(/[?#]/)[0] ?? '';
    pathname = decodeURIComponent(withoutQuery);
  }

  const normalized = pathname.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');

  if (
    segments.length < 2 ||
    !ALLOWED_PUBLIC_ROOTS.includes(
      segments[0] as (typeof ALLOWED_PUBLIC_ROOTS)[number],
    )
  ) {
    return null;
  }

  const hasUnsafeSegment = segments.some(
    (segment) =>
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      !/^[a-zA-Z0-9._-]+$/.test(segment),
  );

  if (hasUnsafeSegment) return null;

  return segments.join('/');
}

export function isLocalPublicAssetReference(reference: string): boolean {
  return extractLocalPublicPath(reference) !== null;
}

export async function readLocalPublicAsset(
  reference: string,
  publicRoot = path.join(process.cwd(), 'public'),
): Promise<LocalPublicAsset> {
  const relativePath = extractLocalPublicPath(reference);

  if (relativePath === null) {
    throw new AssetResolutionError(
      reference,
      'only files under public/fixtures or public/generated can be read on the server.',
    );
  }

  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ publicRoot,
    relativePath,
  );
  const normalizedRoot = path.resolve(/* turbopackIgnore: true */ publicRoot);

  if (
    absolutePath !== normalizedRoot &&
    !absolutePath.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    throw new AssetResolutionError(reference, 'the resolved path escapes public/.');
  }

  try {
    const bytes = await readFile(/* turbopackIgnore: true */ absolutePath);
    const extension = relativePath.split('.').pop()?.toLowerCase() ?? 'png';

    return {
      bytes,
      contentType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
      extension: normalizeExtension(extension),
    };
  } catch {
    throw new AssetResolutionError(
      reference,
      `no file exists at public/${relativePath}.`,
    );
  }
}
