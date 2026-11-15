import { describe, expect, it } from 'vitest';
import {
  appendCostEntry,
  assertWithinBudget,
  createCostLedger,
} from '@/application/services/budget-guardrail';
import type { CostLedger } from '@/domain/entities/campaign';
import { BudgetGuardrailError } from '@/domain/errors/domain-errors';

function ledgerWith(totalUsd: number): CostLedger {
  return {
    totalUsd,
    maxBudgetUsd: 1.5,
    entries: [],
  };
}

describe('budget guardrail', () => {
  it('throws BudgetGuardrailError when a step would exceed the campaign limit', () => {
    const ledger = ledgerWith(1.42);
    const action = () => assertWithinBudget(ledger, 0.1);

    expect(action).toThrow(BudgetGuardrailError);

    try {
      action();
    } catch (error) {
      expect(error).toBeInstanceOf(BudgetGuardrailError);

      if (error instanceof BudgetGuardrailError) {
        expect(error.currentUsd).toBe(1.42);
        expect(error.estimatedCostUsd).toBe(0.1);
        expect(error.maxBudgetUsd).toBe(1.5);
        expect(error.message).toContain('Budget guardrail exceeded');
      }
    }
  });

  it('allows a step that lands exactly on the campaign limit', () => {
    const ledger = ledgerWith(1.45);

    expect(() => assertWithinBudget(ledger, 0.05)).not.toThrow();
  });

  it('appends cost entries immutably and keeps the ledger total in sync', () => {
    const ledger = createCostLedger(1.5);
    const updated = appendCostEntry(ledger, {
      step: 'image',
      model: 'test/image-model',
      costUsd: 0.039,
      note: 'Shot 1 keyframe',
    });

    expect(ledger.totalUsd).toBe(0);
    expect(ledger.entries).toHaveLength(0);
    expect(updated.totalUsd).toBe(0.039);
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0]?.model).toBe('test/image-model');
    expect(updated.maxBudgetUsd).toBe(1.5);
  });
});
