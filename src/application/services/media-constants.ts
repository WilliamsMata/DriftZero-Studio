/**
 * Shared media policy constants for the application layer.
 *
 * These values protect the $10 OpenRouter credit pool and are intentionally
 * code-level caps so they cannot be raised by request payloads.
 */

export const SHOT_COUNT = 3;

export const DEFAULT_VIDEO_DURATION_SECONDS = 4;

export const MIN_FIDELITY_SCORE = 7;

/** Hard cap enforced per shot. Must never exceed 1. */
export const MAX_VISION_QA_RETRIES = 1;

/** Conservative pre-flight reservation for the creative director call. */
export const ESTIMATED_DIRECTOR_USD = 0.01;

/** Conservative pre-flight reservation for a single Vision QA call. */
export const ESTIMATED_VISION_QA_USD = 0.001;

/** Absolute campaign budget ceiling accepted by the API. */
export const HARD_MAX_CAMPAIGN_BUDGET_USD = 10;
