import type { ExecutionMode } from '@/domain/entities/campaign';
import {
  AssetResolutionError,
  ProviderConfigurationError,
  ProviderRequestError,
} from '@/domain/errors/domain-errors';
import {
  getImageContentType,
  isLocalPublicAssetReference,
  readLocalPublicAsset,
} from '@/infrastructure/assets/local-public-assets';
import { detectImageContentType } from '@/infrastructure/storage/base64-image';

/**
 * Shared server-side OpenRouter client.
 *
 * The client is intentionally dependency-free (native `fetch`) and never
 * caches API keys in module scope so local development can swap `.env` values
 * without restarting the process.
 */

export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_APP_TITLE = 'DriftZero Studio';

export type OpenRouterFetch = typeof fetch;

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  mode?: ExecutionMode;
  fetchImpl?: OpenRouterFetch;
}

function readExecutionModeFromEnv(): ExecutionMode {
  const rawMode = process.env.MEDIA_EXECUTION_MODE;
  if (rawMode === 'hybrid' || rawMode === 'live') return rawMode;
  return 'mock';
}

function readApiKeyFromEnv(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  return apiKey === undefined || apiKey === '' ? null : apiKey;
}

export function requireOpenRouterApiKey(mode?: ExecutionMode): string {
  const apiKey = readApiKeyFromEnv();

  if (apiKey !== null) return apiKey;

  const effectiveMode = mode ?? readExecutionModeFromEnv();

  throw new ProviderConfigurationError(
    'OpenRouter',
    'OPENROUTER_API_KEY',
    effectiveMode === 'mock'
      ? 'Mock mode should never call OpenRouter, and no API key is available if it does.'
      : `Execution mode "${effectiveMode}" sends real requests to OpenRouter.`,
  );
}

export function buildOpenRouterHeaders(
  apiKey: string,
  includeJsonContentType = true,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl !== undefined && appUrl !== '') {
    headers['HTTP-Referer'] = appUrl;
  }

  headers['X-Title'] = OPENROUTER_APP_TITLE;

  return headers;
}

function resolveRequestUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${OPENROUTER_API_BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readProviderErrorPayload(rawBody: string): {
  message?: string;
  code?: string;
} {
  try {
    const parsed: unknown = JSON.parse(rawBody);

    if (isRecord(parsed) && isRecord(parsed.error)) {
      return {
        message:
          typeof parsed.error.message === 'string'
            ? parsed.error.message
            : undefined,
        code:
          typeof parsed.error.code === 'string'
            ? parsed.error.code
            : undefined,
      };
    }

    if (isRecord(parsed) && typeof parsed.message === 'string') {
      return { message: parsed.message };
    }
  } catch {
    // Non-JSON error bodies fall through to the trimmed text below.
  }

  return {};
}

export class OpenRouterClient {
  private readonly explicitApiKey?: string;
  private readonly mode: ExecutionMode;
  private readonly fetchImpl: OpenRouterFetch;

  constructor(options: OpenRouterClientOptions = {}) {
    this.explicitApiKey = options.apiKey?.trim();
    this.mode = options.mode ?? readExecutionModeFromEnv();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private resolveApiKey(): string {
    if (this.explicitApiKey !== undefined && this.explicitApiKey !== '') {
      return this.explicitApiKey;
    }

    return requireOpenRouterApiKey(this.mode);
  }

  async requestJson<T>(
    pathOrUrl: string,
    init: RequestInit,
    timeoutMs = 60_000,
  ): Promise<T> {
    const response = await this.request(pathOrUrl, init, timeoutMs);

    try {
      const payload: unknown = await response.json();
      return payload as T;
    } catch {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: response.status,
        providerMessage: 'the response body was not valid JSON.',
      });
    }
  }

  async request(
    pathOrUrl: string,
    init: RequestInit,
    timeoutMs = 60_000,
  ): Promise<Response> {
    const apiKey = this.resolveApiKey();
    const url = resolveRequestUrl(pathOrUrl);
    const headers = new Headers(buildOpenRouterHeaders(apiKey));

    if (init.headers !== undefined) {
      const extraHeaders = new Headers(init.headers);
      extraHeaders.forEach((value, key) => headers.set(key, value));
    }

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'the network request failed.';

      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 0,
        providerMessage: message,
      });
    }

    if (!response.ok) {
      const rawBody = await response.text().catch(() => '');
      const parsed = readProviderErrorPayload(rawBody);
      const providerMessage =
        parsed.message ??
        (rawBody.trim() === ''
          ? response.statusText || 'the provider returned an empty error body.'
          : rawBody.trim().slice(0, 500));

      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: response.status,
        providerMessage,
        providerCode: parsed.code,
      });
    }

    return response;
  }
}

/**
 * Converts a local `public/` image reference (or a localhost URL pointing at
 * one) into a base64 data URI so Vision QA and the Image API can read preset
 * anchors before deployment. Remote HTTPS and existing data URIs pass
 * through unchanged.
 */
export async function resolveLocalAssetToDataUri(
  urlOrPath: string,
): Promise<string> {
  const trimmed = urlOrPath.trim();

  if (trimmed === '') {
    throw new AssetResolutionError(urlOrPath, 'the reference is empty.');
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('blob:')) {
    throw new AssetResolutionError(
      urlOrPath,
      'browser blob URLs cannot be read on the server. Upload the file through /api/assets/upload first.',
    );
  }

  if (/^http:\/\//i.test(trimmed)) {
    if (!isLocalPublicAssetReference(trimmed)) {
      throw new AssetResolutionError(
        urlOrPath,
        'only http://localhost references to public/fixtures or public/generated are supported. Use HTTPS for remote images.',
      );
    }
  } else if (!isLocalPublicAssetReference(trimmed)) {
    throw new AssetResolutionError(
      urlOrPath,
      'only public/fixtures and public/generated paths, localhost URLs, HTTPS URLs, or data URIs are supported.',
    );
  }

  const asset = await readLocalPublicAsset(trimmed);
  const declaredContentType =
    asset.contentType === 'application/octet-stream'
      ? getImageContentType(trimmed)
      : asset.contentType;
  // Generated keyframes may have been saved before their real media type was
  // preserved. Detect from bytes so a JPEG never reaches the provider labeled
  // as `image/png`.
  const contentType = detectImageContentType(
    asset.bytes,
    declaredContentType,
  );

  return `data:${contentType};base64,${asset.bytes.toString('base64')}`;
}

/**
 * Conservative fallback when OpenRouter omits `usage.cost`. When the selected
 * model pricing is available it uses the exact per-token rates; otherwise it
 * falls back to deliberately high blended rates so ledgers never under-report.
 */
export interface ChatModelPricing {
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
}

export function estimateChatUsageCostUsd(
  usage: OpenRouterUsage | undefined,
  pricing?: ChatModelPricing,
): number {
  if (!usage) return 0;

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cost =
    pricing !== undefined
      ? (promptTokens / 1_000_000) * pricing.inputCostPerMillionUsd +
        (completionTokens / 1_000_000) * pricing.outputCostPerMillionUsd
      : (promptTokens / 1_000_000) * 0.4 +
        (completionTokens / 1_000_000) * 3;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Builds a diagnostic message for a 200 response whose visible content is
 * empty. Reasoning models can spend their whole output budget on reasoning
 * tokens and return `finish_reason: "length"` with `content: null`;
 * surfacing those fields makes the failure actionable.
 */
export interface ChatCompletionDiagnostics {
  finishReason?: string | null;
  reasoningTokens?: number;
  contentPreview?: string;
  parseError?: string;
  provider?: string;
}

export function describeEmptyChatCompletion(
  role: string,
  diagnostics: ChatCompletionDiagnostics,
): string {
  const facts: string[] = [];

  if (
    diagnostics.finishReason !== undefined &&
    diagnostics.finishReason !== null
  ) {
    facts.push(`finish_reason: ${diagnostics.finishReason}`);
  }

  if (diagnostics.reasoningTokens !== undefined) {
    facts.push(`reasoning_tokens: ${diagnostics.reasoningTokens}`);
  }

  if (diagnostics.provider !== undefined) {
    facts.push(`provider: ${diagnostics.provider}`);
  }

  if (facts.length === 0) {
    return `the ${role} returned an empty response.`;
  }

  return (
    `the ${role} returned an empty response (${facts.join(', ')}). ` +
    'The model may have exhausted its output budget on reasoning.'
  );
}

/**
 * Builds a diagnostic message when a chat response is non-empty but cannot be
 * parsed as the expected JSON. Includes a short preview so a prose/refusal
 * response is distinguishable from a truncated JSON object.
 */
export function describeInvalidChatCompletion(
  role: string,
  diagnostics: ChatCompletionDiagnostics,
  attempts: number,
): string {
  const facts: string[] = [];

  if (
    diagnostics.finishReason !== undefined &&
    diagnostics.finishReason !== null
  ) {
    facts.push(`finish_reason: ${diagnostics.finishReason}`);
  }

  if (diagnostics.reasoningTokens !== undefined) {
    facts.push(`reasoning_tokens: ${diagnostics.reasoningTokens}`);
  }

  if (diagnostics.provider !== undefined) {
    facts.push(`provider: ${diagnostics.provider}`);
  }

  if (diagnostics.parseError !== undefined) {
    facts.push(`parse_error: ${diagnostics.parseError}`);
  }

  const details = facts.length > 0 ? ` (${facts.join(', ')})` : '';
  const preview = diagnostics.contentPreview?.trim().slice(0, 240);
  const previewText =
    preview !== undefined && preview !== ''
      ? ` Response preview: ${JSON.stringify(preview)}.`
      : '';

  return `the ${role} returned no usable JSON after ${attempts} attempt${
    attempts === 1 ? '' : 's'
  }${details}.${previewText}`;
}

/**
 * Chat models occasionally wrap JSON in Markdown fences despite the response
 * format hint. This extracts the first complete JSON object.
 */
export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');

    if (start === -1 || end <= start) {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 200,
        providerMessage: 'the model response did not contain a JSON object.',
      });
    }

    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      throw new ProviderRequestError({
        provider: 'OpenRouter',
        status: 200,
        providerMessage: 'the model response contained malformed JSON.',
      });
    }
  }
}
