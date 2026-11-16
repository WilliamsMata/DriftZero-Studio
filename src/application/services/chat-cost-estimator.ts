import type { ChatModelCapability } from '@/domain/entities/model-capabilities';
import { roundUsd } from './budget-guardrail';

/**
 * Token assumptions used only for pre-flight reservations and the UI estimate.
 * Actual spend always comes from OpenRouter's `usage.cost` when available.
 *
 * The director reservation includes the product anchor image (multimodal
 * input), not just text, so it is deliberately larger than a text-only call.
 */
export const ESTIMATED_PLAN_INPUT_TOKENS = 6_000;
export const ESTIMATED_PLAN_OUTPUT_TOKENS = 1_500;
export const ESTIMATED_VISION_QA_INPUT_TOKENS = 4_000;
export const ESTIMATED_VISION_QA_OUTPUT_TOKENS = 400;
export const ESTIMATED_BRIEF_INPUT_TOKENS = 800;
export const ESTIMATED_BRIEF_OUTPUT_TOKENS = 400;

export function estimateChatCostUsd(
  model: ChatModelCapability,
  inputTokens: number,
  outputTokens: number,
): number {
  return roundUsd(
    (inputTokens / 1_000_000) * model.inputCostPerMillionUsd +
      (outputTokens / 1_000_000) * model.outputCostPerMillionUsd,
  );
}

/** Approximate cost of one creative-director call. */
export function estimatePlanCostUsd(model: ChatModelCapability): number {
  return estimateChatCostUsd(
    model,
    ESTIMATED_PLAN_INPUT_TOKENS,
    ESTIMATED_PLAN_OUTPUT_TOKENS,
  );
}

/** Approximate cost of one Vision QA call (two images + prompt). */
export function estimateVisionQaCostUsd(model: ChatModelCapability): number {
  return estimateChatCostUsd(
    model,
    ESTIMATED_VISION_QA_INPUT_TOKENS,
    ESTIMATED_VISION_QA_OUTPUT_TOKENS,
  );
}

/** Approximate cost of one text-only creative-brief draft. */
export function estimateBriefCostUsd(model: ChatModelCapability): number {
  return estimateChatCostUsd(
    model,
    ESTIMATED_BRIEF_INPUT_TOKENS,
    ESTIMATED_BRIEF_OUTPUT_TOKENS,
  );
}
