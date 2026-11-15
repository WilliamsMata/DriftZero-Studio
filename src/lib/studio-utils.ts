import type {
  AspectRatio,
  BrandTone,
  CostEntry,
  ShotResult,
} from "@/domain/entities/campaign";
import type { ExecutionMode } from "@/domain/entities/campaign";

export type StudioStep =
  | "idle"
  | "planning"
  | "keyframes"
  | "submitting-videos"
  | "polling-videos"
  | "completed"
  | "error";

export const DEFAULT_MAX_BUDGET_USD = 1.5;
export const MIN_BUDGET_USD = 0.5;
export const MAX_BUDGET_USD = 3;
export const TOTAL_MEDIA_BUDGET_USD = 10;
export const DEFAULT_SHOT_DURATION_SECONDS = 4;

export const TONE_OPTIONS: ReadonlyArray<{
  value: BrandTone;
  label: string;
  hint: string;
}> = [
  {
    value: "luxury-editorial",
    label: "Luxury Editorial",
    hint: "Cinematic restraint, warm light, premium product hero framing.",
  },
  {
    value: "tiktok-ugc",
    label: "TikTok High-Energy UGC",
    hint: "Fast cuts, handheld energy, native social pacing and captions.",
  },
  {
    value: "minimalist-studio",
    label: "Minimalist Studio",
    hint: "Clean geometry, controlled reflections, quiet architectural framing.",
  },
];

export const TONE_LABELS: Record<BrandTone, string> = {
  "luxury-editorial": "Luxury Editorial",
  "tiktok-ugc": "TikTok High-Energy UGC",
  "minimalist-studio": "Minimalist Studio",
};

export const ASPECT_RATIO_OPTIONS: ReadonlyArray<{
  value: AspectRatio;
  label: string;
  orientation: string;
}> = [
  { value: "9:16", label: "9:16", orientation: "Vertical" },
  { value: "16:9", label: "16:9", orientation: "Wide" },
  { value: "1:1", label: "1:1", orientation: "Square" },
];

export const SHOT_ROLE_LABELS: Record<
  "hero-packshot" | "lifestyle-context" | "macro-finale",
  string
> = {
  "hero-packshot": "Hero Packshot",
  "lifestyle-context": "Lifestyle Context",
  "macro-finale": "Macro Finale",
};

export const COST_STEP_LABELS: Record<CostEntry["step"], string> = {
  director: "Director",
  image: "Keyframes",
  "vision-qa": "Vision QA",
  video: "Video Render",
};

export const VIDEO_STATUS_META: Record<
  ShotResult["videoStatus"],
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
    indicatorClassName: string;
  }
> = {
  idle: {
    label: "Idle",
    badgeClassName: "border-white/10 bg-white/[0.03] text-muted-foreground",
    dotClassName: "bg-zinc-500",
    indicatorClassName: "bg-zinc-600",
  },
  queued: {
    label: "Queued",
    badgeClassName: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    dotClassName: "bg-sky-300",
    indicatorClassName: "bg-sky-400",
  },
  processing: {
    label: "Processing",
    badgeClassName: "border-violet-400/25 bg-violet-400/10 text-violet-200",
    dotClassName: "animate-pulse bg-violet-300",
    indicatorClassName: "bg-violet-400",
  },
  completed: {
    label: "Ready",
    badgeClassName: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    dotClassName: "bg-emerald-300",
    indicatorClassName: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    badgeClassName: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    dotClassName: "bg-rose-300",
    indicatorClassName: "bg-rose-400",
  },
};

export const STEP_META: Record<
  StudioStep,
  { label: string; description: string }
> = {
  idle: {
    label: "Configuration ready",
    description: "Plan a campaign or load a showcase preset.",
  },
  planning: {
    label: "Directing",
    description: "The creative director is writing the three-shot blueprint.",
  },
  keyframes: {
    label: "Keyframes + Vision QA",
    description: "Generating product-faithful keyframes and self-healing drift.",
  },
  "submitting-videos": {
    label: "Submitting video jobs",
    description: "Queueing image-to-video renders with the selected model.",
  },
  "polling-videos": {
    label: "Rendering videos",
    description: "Polling provider job status until all three shots settle.",
  },
  completed: {
    label: "Campaign complete",
    description: "The sequential commercial is ready to review.",
  },
  error: {
    label: "Run stopped",
    description: "Review the error, adjust the configuration, and retry.",
  },
};

export const MODE_LABELS: Record<ExecutionMode, string> = {
  mock: "Mock",
  hybrid: "Hybrid",
  live: "Live OpenRouter",
};

export function isStudioBusy(step: StudioStep): boolean {
  return (
    step === "planning" ||
    step === "keyframes" ||
    step === "submitting-videos" ||
    step === "polling-videos"
  );
}

export function isBrandTone(value: string): value is BrandTone {
  return TONE_OPTIONS.some((option) => option.value === value);
}

export function isShotIndex(value: number): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

export function formatUsd(value: number, digits = 2): string {
  return `$${value.toFixed(digits)}`;
}

/**
 * Money in the studio has two roles: campaign totals (two decimals) and unit
 * or ledger costs, which need a third decimal to stay truthful below $1.
 */
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return "$0.00";
  if (Math.abs(value) < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

export function estimateMediaCostUsd(
  imageCostPerImageUsd: number,
  videoCostPerSecondUsd: number,
  durationSeconds: number,
  shotCount = 3,
): number {
  return (
    shotCount * imageCostPerImageUsd +
    shotCount * videoCostPerSecondUsd * durationSeconds
  );
}

export function clampBudget(value: number): number {
  const clamped = Math.min(Math.max(value, MIN_BUDGET_USD), MAX_BUDGET_USD);
  return Math.round(clamped * 100) / 100;
}

export function toBrandHandle(productName: string): string {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  return `@${slug === "" ? "driftzero" : slug}`;
}

export function shortJobId(jobId: string | undefined): string {
  if (!jobId) return "not queued";
  return jobId.length > 14 ? `${jobId.slice(0, 6)}…${jobId.slice(-4)}` : jobId;
}
