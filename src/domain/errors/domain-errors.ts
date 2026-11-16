/**
 * Domain-level errors. These are transport-agnostic and are mapped to HTTP
 * responses at the Route Handler boundary.
 */

export class BudgetGuardrailError extends Error {
  readonly currentUsd: number;
  readonly estimatedCostUsd: number;
  readonly maxBudgetUsd: number;

  constructor(params: {
    currentUsd: number;
    estimatedCostUsd: number;
    maxBudgetUsd: number;
  }) {
    const projectedUsd = params.currentUsd + params.estimatedCostUsd;
    const formatUsd = (value: number) => `$${value.toFixed(4)}`;
    super(
      `Budget guardrail exceeded: current ${formatUsd(
        params.currentUsd,
      )} + estimated ${formatUsd(
        params.estimatedCostUsd,
      )} = ${formatUsd(projectedUsd)} exceeds the ${formatUsd(
        params.maxBudgetUsd,
      )} campaign limit.`,
    );
    this.name = 'BudgetGuardrailError';
    this.currentUsd = params.currentUsd;
    this.estimatedCostUsd = params.estimatedCostUsd;
    this.maxBudgetUsd = params.maxBudgetUsd;
  }
}

export class ProviderCapabilityError extends Error {
  readonly modelId: string;
  readonly reason: string;

  constructor(modelId: string, reason: string) {
    super(`Model "${modelId}" cannot run this request: ${reason}`);
    this.name = 'ProviderCapabilityError';
    this.modelId = modelId;
    this.reason = reason;
  }
}

export class InvalidWorkflowStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWorkflowStateError';
  }
}

/**
 * Raised when a live provider is selected but its server-side configuration is
 * incomplete. The message is safe to surface in the studio UI and always names
 * the missing environment variable.
 */
export class ProviderConfigurationError extends Error {
  readonly provider: string;
  readonly missingEnvVar: string;

  constructor(provider: string, missingEnvVar: string, hint: string) {
    super(
      `${provider} is not configured: ${hint} Set ${missingEnvVar} before running this mode.`,
    );
    this.name = 'ProviderConfigurationError';
    this.provider = provider;
    this.missingEnvVar = missingEnvVar;
  }
}

/**
 * Upstream provider failure carrying the HTTP status and the sanitized
 * provider message so Route Handlers can return an actionable response
 * without leaking request headers or credentials.
 */
export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly providerMessage: string;
  readonly providerCode?: string;

  constructor(params: {
    provider: string;
    status: number;
    providerMessage: string;
    providerCode?: string;
  }) {
    super(
      `${params.provider} request failed${
        params.status > 0 ? ` (HTTP ${params.status})` : ''
      }: ${params.providerMessage}`,
    );
    this.name = 'ProviderRequestError';
    this.provider = params.provider;
    this.status = params.status;
    this.providerMessage = params.providerMessage;
    this.providerCode = params.providerCode;
  }
}

/** Raised when a local `public/` asset cannot be resolved for a provider. */
export class AssetResolutionError extends Error {
  readonly reference: string;

  constructor(reference: string, reason: string) {
    super(`Asset "${reference}" could not be resolved: ${reason}`);
    this.name = 'AssetResolutionError';
    this.reference = reference;
  }
}

/** Raised when an uploaded product anchor is rejected before persistence. */
export class AssetUploadError extends Error {
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.name = 'AssetUploadError';
    this.reason = reason;
  }
}
