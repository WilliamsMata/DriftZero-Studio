import type { CostEntry, CostLedger } from '@/domain/entities/campaign';
import { BudgetGuardrailError } from '@/domain/errors/domain-errors';

const MONEY_PRECISION = 1_000_000;
const MONEY_EPSILON = 1e-9;

export function roundUsd(value: number): number {
  return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
}

function assertFiniteNonNegativeUsd(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative USD amount.`);
  }
}

/**
 * Throws when the projected campaign spend would exceed the ledger's limit.
 * Call this before every billable generation step.
 */
export function assertWithinBudget(
  ledger: CostLedger,
  estimatedNextUsd: number,
): void {
  assertFiniteNonNegativeUsd(ledger.totalUsd, 'Ledger total');
  assertFiniteNonNegativeUsd(ledger.maxBudgetUsd, 'Ledger budget');
  assertFiniteNonNegativeUsd(estimatedNextUsd, 'Estimated next cost');

  const projectedUsd = roundUsd(ledger.totalUsd + estimatedNextUsd);
  if (projectedUsd > ledger.maxBudgetUsd + MONEY_EPSILON) {
    throw new BudgetGuardrailError({
      currentUsd: ledger.totalUsd,
      estimatedCostUsd: estimatedNextUsd,
      maxBudgetUsd: ledger.maxBudgetUsd,
    });
  }
}

/**
 * Returns a new ledger with the cost entry appended. The input ledger is never
 * mutated so use cases can safely keep previous snapshots for the UI.
 */
export function appendCostEntry(
  ledger: CostLedger,
  entry: CostEntry,
): CostLedger {
  assertFiniteNonNegativeUsd(entry.costUsd, 'Cost entry');

  return {
    totalUsd: roundUsd(ledger.totalUsd + entry.costUsd),
    maxBudgetUsd: ledger.maxBudgetUsd,
    entries: [...ledger.entries, entry],
  };
}

export function createCostLedger(maxBudgetUsd: number): CostLedger {
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0) {
    throw new RangeError('Campaign budget must be a positive USD amount.');
  }

  return {
    totalUsd: 0,
    maxBudgetUsd: roundUsd(maxBudgetUsd),
    entries: [],
  };
}
