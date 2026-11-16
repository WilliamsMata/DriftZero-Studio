import type {
  MobileStudioDrawer,
  MobileStudioTab,
  TabletStudioTab,
} from "@/store/use-studio-store";

export const STUDIO_TOUR_TARGET_ATTRIBUTE = "data-tour";
export const STUDIO_TOUR_SEEN_STORAGE_KEY = "driftzero_tour_seen_v1";

export type StudioTourSide = "top" | "right" | "bottom" | "left";
export type StudioTourAlign = "start" | "center" | "end";

export interface StudioTourStep {
  /** Stable semantic id shared by the desktop, tablet, and mobile target. */
  id: string;
  title: string;
  description: string;
  side?: StudioTourSide;
  align?: StudioTourAlign;
  /** Navigation required before the mobile target can be shown. */
  mobile?: {
    tab?: MobileStudioTab;
    drawer?: Exclude<MobileStudioDrawer, null>;
  };
  /** Navigation required before the tablet target can be shown. */
  tabletTab?: TabletStudioTab;
  /** Driver focus mode. Drawer steps disable the popover focus trap. */
  focus?: "popover" | "element" | "none";
}

/**
 * Eight milestones that cover the current studio surface:
 * showcase/mode, anchor upload, creative direction, capability routing,
 * guarded execution, director brief + storyboard QA, the commercial player,
 * and the FinOps ledger.
 */
export const STUDIO_TOUR_STEPS: readonly StudioTourStep[] = [
  {
    id: "showcase-presets",
    title: "Showcase & run mode",
    description:
      "Load a finished demo campaign, then pick Mock ($0), Hybrid, or budget-guarded Live execution.",
    side: "bottom",
    align: "start",
  },
  {
    id: "product-anchor",
    title: "Product anchor",
    description:
      "Choose or upload a product photo. Visual DNA is extracted directly from it to prevent drift.",
    side: "right",
    align: "start",
    mobile: { tab: "create" },
  },
  {
    id: "creative-direction",
    title: "Creative direction",
    description:
      "Pick brand tone, aspect ratio, and 1–5 shots. Draft or edit an optional AI creative brief.",
    side: "right",
    align: "start",
    mobile: { tab: "create" },
  },
  {
    id: "model-capabilities",
    title: "Capability-aware routing",
    description:
      "Mix OpenRouter models per task. Ratios, clip length, and cost estimates validate dynamically before running.",
    side: "right",
    align: "start",
    mobile: { tab: "create", drawer: "model" },
    focus: "none",
  },
  {
    id: "execution-pipeline",
    title: "Guarded execution",
    description:
      "Run full-auto or step-by-step. Live mode confirms first and reserves spend against your budget cap.",
    side: "top",
    align: "start",
  },
  {
    id: "storyboard-qa",
    title: "Director brief & Vision QA",
    description:
      "Edit ad copy, compare anchor vs. keyframe fidelity, inspect Vision QA auto-repairs, and track render progress.",
    side: "top",
    align: "center",
    mobile: { tab: "storyboard" },
    tabletTab: "storyboard",
  },
  {
    id: "commercial-player",
    title: "Commercial player",
    description:
      "Watch clips in sequence, toggle the TikTok/Reels safe-zone with live copy, and download any MP4.",
    side: "left",
    align: "center",
    mobile: { tab: "player" },
    tabletTab: "player",
  },
  {
    id: "finops-ledger",
    title: "FinOps ledger",
    description:
      "Live per-step cost breakdown by model against your remaining campaign budget cap.",
    side: "left",
    align: "center",
    mobile: { tab: "finops" },
    tabletTab: "player",
  },
];

export function studioTourSelector(stepId: string): string {
  return `[${STUDIO_TOUR_TARGET_ATTRIBUTE}="${stepId}"]`;
}
