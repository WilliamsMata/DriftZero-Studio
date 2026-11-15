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
