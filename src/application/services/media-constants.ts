/**
 * Shared media policy constants for the application layer.
 *
 * These values protect the $10 OpenRouter credit pool and are intentionally
 * code-level caps so they cannot be raised by request payloads.
 */

/** Maximum number of concurrent provider calls per media batch. */
export const MEDIA_CONCURRENCY = 3;

export const DEFAULT_VIDEO_DURATION_SECONDS = 4;

/** Inclusive clip-length range accepted by the product. */
export const MIN_VIDEO_DURATION_SECONDS = 1;
export const MAX_VIDEO_DURATION_SECONDS = 10;

export const MIN_FIDELITY_SCORE = 7;

/** Hard cap enforced per shot. Must never exceed 1. */
export const MAX_VISION_QA_RETRIES = 1;

/** Absolute campaign budget ceiling accepted by the API. */
export const HARD_MAX_CAMPAIGN_BUDGET_USD = 10;
