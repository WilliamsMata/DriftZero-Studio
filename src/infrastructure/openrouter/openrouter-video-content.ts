import { ProviderConfigurationError, ProviderRequestError } from '@/domain/errors/domain-errors';
import {
  OPENROUTER_API_BASE_URL,
  buildOpenRouterHeaders,
  requireOpenRouterApiKey,
} from './openrouter-client';

export interface OpenRouterVideoContent {
  body: ReadableStream<Uint8Array> | null;
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
}

/**
 * Server-side streaming proxy for completed OpenRouter video jobs.
 *
 * The browser must never receive the OpenRouter API key or an unsigned URL,
 * so `<video>` playback always goes through this service.
 */
export async function fetchOpenRouterVideoContent(
  jobId: string,
  rangeHeader?: string,
): Promise<OpenRouterVideoContent> {
  const apiKey = requireOpenRouterApiKey();

  if (apiKey.trim() === '') {
    throw new ProviderConfigurationError(
      'OpenRouter',
      'OPENROUTER_API_KEY',
      'Video playback is proxied server-side and needs an API key.',
    );
  }

  const headers = buildOpenRouterHeaders(apiKey, false);
  if (rangeHeader !== undefined && rangeHeader.trim() !== '') {
    headers.Range = rangeHeader;
  }

  const url = `${OPENROUTER_API_BASE_URL}/videos/${encodeURIComponent(
    jobId,
  )}/content`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new ProviderRequestError({
      provider: 'OpenRouter',
      status: 0,
      providerMessage:
        error instanceof Error
          ? error.message
          : 'the video content request failed.',
    });
  }

  if (!response.ok) {
    const message = await response
      .text()
      .then((body) => body.trim().slice(0, 500))
      .catch(() => '');

    throw new ProviderRequestError({
      provider: 'OpenRouter',
      status: response.status,
      providerMessage:
        message === ''
          ? response.statusText || 'video content is unavailable.'
          : message,
    });
  }

  const upstreamContentType = response.headers.get('content-type') ?? '';
  const contentType = upstreamContentType.startsWith('video/')
    ? upstreamContentType
    : 'video/mp4';

  return {
    body: response.body,
    status: response.status === 206 ? 206 : 200,
    contentType,
    contentLength: response.headers.get('content-length'),
    contentRange: response.headers.get('content-range'),
    acceptRanges: response.headers.get('accept-ranges'),
  };
}
