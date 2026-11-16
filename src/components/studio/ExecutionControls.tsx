"use client";

import { useState } from "react";
import {
  ClipboardList,
  Film,
  ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  Zap,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioStore } from "@/store/use-studio-store";
import type {
  CampaignState,
  ExecutionMode,
} from "@/domain/entities/campaign";
import {
  MODE_BADGE_CLASS,
  useStudioCostEstimate,
} from "@/components/studio/studio-primitives";
import {
  MODE_LABELS,
  STEP_META,
  applyExecutionModeToEstimate,
  formatCost,
  formatUsd,
  isStudioBusy,
  type CampaignCostEstimate,
  type StudioStep,
} from "@/lib/studio-utils";

export type RunAction = "full" | "plan" | "keyframes" | "videos";

export interface StudioExecution {
  busy: boolean;
  canPlan: boolean;
  canKeyframes: boolean;
  canVideos: boolean;
  pendingRun: RunAction | null;
  requestRun: (action: RunAction) => void;
  setPendingRun: (action: RunAction | null) => void;
  executePendingRun: () => void;
  campaign: CampaignState | null;
  mode: ExecutionMode;
  maxBudgetUsd: number;
  costEstimate: CampaignCostEstimate;
  activeStep: StudioStep;
  errorMessage: string | null;
}

/**
 * Shared run coordinator for every responsive shell. It reads the same store
 * actions, applies the same capability gating, and asks for confirmation only
 * when a live request could spend real credits.
 */
export function useStudioExecution(): StudioExecution {
  const mode = useStudioStore((state) => state.mode);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const product = useStudioStore((state) => state.product);
  const textModels = useStudioStore((state) => state.textModels);
  const visionModels = useStudioStore((state) => state.visionModels);
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);
  const errorMessage = useStudioStore((state) => state.errorMessage);
  const runPlan = useStudioStore((state) => state.runPlan);
  const runKeyframes = useStudioStore((state) => state.runKeyframes);
  const runVideos = useStudioStore((state) => state.runVideos);
  const runFullPipeline = useStudioStore((state) => state.runFullPipeline);

  const {
    textModel,
    visionModel,
    imageModel,
    videoModel,
    durationSeconds,
    costEstimate,
  } = useStudioCostEstimate();
  const [pendingRun, setPendingRun] = useState<RunAction | null>(null);

  const busy = isStudioBusy(activeStep);
  const aspectSupported =
    (!imageModel || imageModel.supportedAspectRatios.includes(aspectRatio)) &&
    (!videoModel || videoModel.supportedAspectRatios.includes(aspectRatio));
  const durationSupported =
    !videoModel || videoModel.supportedDurations.includes(durationSeconds);

  const productReady =
    product.name.trim() !== "" &&
    product.category.trim() !== "" &&
    product.imageUrl.trim() !== "";
  const modelsReady =
    textModels.length > 0 &&
    visionModels.length > 0 &&
    textModel !== undefined &&
    visionModel !== undefined &&
    imageModel !== undefined &&
    videoModel !== undefined;
  const canPlan =
    productReady && modelsReady && aspectSupported && durationSupported && !busy;

  const keyframesReady =
    campaign !== null &&
    campaign.results.length === campaign.shots.length &&
    campaign.results.every((result) => result.keyframeUrl.trim() !== "");
  const canKeyframes = campaign !== null && !busy;
  const canVideos = keyframesReady && !busy;

  function executeRun(action: RunAction): void {
    switch (action) {
      case "plan":
        void runPlan();
        return;
      case "keyframes":
        void runKeyframes();
        return;
      case "videos":
        void runVideos();
        return;
      default:
        void runFullPipeline();
    }
  }

  function requestRun(action: RunAction): void {
    const effectiveMode =
      action === "full" ? mode : (campaign?.mode ?? mode);

    if (effectiveMode === "live") {
      setPendingRun(action);
      return;
    }

    executeRun(action);
  }

  function executePendingRun(): void {
    const action = pendingRun;
    setPendingRun(null);
    if (action) executeRun(action);
  }

  return {
    busy,
    canPlan,
    canKeyframes,
    canVideos,
    pendingRun,
    requestRun,
    setPendingRun,
    executePendingRun,
    campaign,
    mode,
    maxBudgetUsd,
    costEstimate,
    activeStep,
    errorMessage,
  };
}

function liveRunLabel(action: RunAction | null): string {
  switch (action) {
    case "plan":
      return "Plan the campaign live";
    case "keyframes":
      return "Generate keyframes live";
    case "videos":
      return "Render videos live";
    default:
      return "Run the full pipeline live";
  }
}

export function LiveRunDialog({
  execution,
}: {
  execution: StudioExecution;
}) {
  const { pendingRun, setPendingRun, campaign, mode, maxBudgetUsd } = execution;
  const dialogMode =
    pendingRun === "full" ? mode : (campaign?.mode ?? mode);
  const dialogEstimateUsd = applyExecutionModeToEstimate(
    execution.costEstimate,
    dialogMode,
  ).totalUsd;
  const campaignCapUsd = campaign?.ledger.maxBudgetUsd ?? maxBudgetUsd;
  const campaignSpendUsd = campaign?.ledger.totalUsd ?? 0;
  const label = liveRunLabel(pendingRun);

  return (
    <Dialog
      open={pendingRun !== null}
      onOpenChange={(open) => {
        if (!open) setPendingRun(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}?</DialogTitle>
          <DialogDescription>
            Live mode sends real OpenRouter requests. Nothing is charged before
            the budget guardrail approves each step.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Execution mode</dt>
            <dd className="font-medium text-rose-200">Live OpenRouter</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Estimated full run</dt>
            <dd className="font-mono text-foreground">
              {formatUsd(dialogEstimateUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Campaign cap</dt>
            <dd className="font-mono text-foreground">
              {formatUsd(campaignCapUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Spent so far</dt>
            <dd className="font-mono text-foreground">
              {formatCost(campaignSpendUsd)}
            </dd>
          </div>
        </dl>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPendingRun(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={execution.executePendingRun}
            className="bg-rose-500 text-white hover:bg-rose-400"
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExecutionStepButtons({
  execution,
  layout = "grid",
  touch = false,
}: {
  execution: StudioExecution;
  layout?: "grid" | "stack";
  touch?: boolean;
}) {
  const activeStep = execution.activeStep;

  return (
    <div
      className={cn(
        layout === "grid" ? "grid grid-cols-3 gap-1.5" : "grid gap-2",
      )}
    >
      <Button
        type="button"
        variant="outline"
        size={touch ? "default" : "sm"}
        disabled={!execution.canPlan}
        onClick={() => execution.requestRun("plan")}
        className={cn(
          "gap-1.5",
          touch ? "h-11 text-[12px]" : "h-9 px-1.5 text-[11px]",
        )}
      >
        {activeStep === "planning" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ClipboardList className="size-3.5" />
        )}
        1. Plan
      </Button>
      <Button
        type="button"
        variant="outline"
        size={touch ? "default" : "sm"}
        disabled={!execution.canKeyframes}
        onClick={() => execution.requestRun("keyframes")}
        className={cn(
          "gap-1.5",
          touch ? "h-11 text-[12px]" : "h-9 px-1.5 text-[11px]",
        )}
      >
        {activeStep === "keyframes" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
        2. Keyframes
      </Button>
      <Button
        type="button"
        variant="outline"
        size={touch ? "default" : "sm"}
        disabled={!execution.canVideos}
        onClick={() => execution.requestRun("videos")}
        className={cn(
          "gap-1.5",
          touch ? "h-11 text-[12px]" : "h-9 px-1.5 text-[11px]",
        )}
      >
        {activeStep === "submitting-videos" ||
        activeStep === "polling-videos" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Film className="size-3.5" />
        )}
        3. Videos
      </Button>
    </div>
  );
}

export function ExecutionControls({
  className,
  touch = false,
}: {
  className?: string;
  touch?: boolean;
}) {
  const execution = useStudioExecution();
  const {
    campaign,
    mode,
    activeStep,
    errorMessage,
    busy,
    costEstimate,
    maxBudgetUsd,
  } = execution;
  const resetCampaign = useStudioStore((state) => state.resetCampaign);

  const stepMeta = STEP_META[activeStep];
  const estimatedTotalUsd = applyExecutionModeToEstimate(
    costEstimate,
    mode,
  ).totalUsd;
  const estimatedWorstCaseUsd = applyExecutionModeToEstimate(
    costEstimate,
    mode,
  ).worstCaseTotalUsd;
  const campaignCapUsd = campaign?.ledger.maxBudgetUsd ?? maxBudgetUsd;

  const ctaLabel = (() => {
    switch (activeStep) {
      case "planning":
        return "Directing campaign…";
      case "keyframes":
        return "Generating keyframes…";
      case "submitting-videos":
        return "Submitting video jobs…";
      case "polling-videos":
        return "Rendering videos…";
      default:
        return campaign ? "Re-run pipeline" : "Run full pipeline";
    }
  })();

  return (
    <Card
      className={cn(
        "shrink-0 gap-0 overflow-hidden border-white/5 bg-card/85 py-0 ring-1 ring-white/10 backdrop-blur-sm",
        className,
      )}
    >
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-foreground/90 uppercase">
            <Zap className="size-3.5 text-amber-300" />
            Execution
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={resetCampaign}
              disabled={!campaign && !busy && errorMessage === null}
              aria-label="Reset campaign"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
            </Button>
            <Badge
              variant="outline"
              className={cn(
                "h-6 shrink-0 px-2 text-[11px] font-medium",
                MODE_BADGE_CLASS[mode],
              )}
            >
              Next run · {MODE_LABELS[mode]}
            </Badge>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
            activeStep === "error"
              ? "border-rose-400/20 bg-rose-500/[0.07]"
              : busy
                ? "border-amber-400/20 bg-amber-400/[0.06]"
                : "border-white/[0.07] bg-white/[0.02]",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-300" />
          ) : activeStep === "error" ? (
            <TriangleAlert className="size-3.5 shrink-0 text-rose-300" />
          ) : (
            <Sparkles className="size-3.5 shrink-0 text-amber-300" />
          )}
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
            {stepMeta.label}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {mode === "mock" ? "Mock" : "Est."}{" "}
            {formatCost(estimatedTotalUsd)} / {formatUsd(campaignCapUsd)}
          </span>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => execution.requestRun("full")}
          disabled={!execution.canPlan}
          className={cn(
            "w-full gap-2 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 text-[12px] font-semibold text-zinc-950 shadow-[0_12px_32px_-12px_rgba(251,191,36,0.65)] hover:from-amber-100 hover:via-amber-200 hover:to-orange-200",
            touch ? "h-11" : "h-10",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <WandSparkles className="size-4" />
          )}
          {ctaLabel}
        </Button>

        <ExecutionStepButtons execution={execution} touch={touch} />

        {campaign && campaign.mode !== mode ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Steps reuse the loaded {MODE_LABELS[campaign.mode]} campaign.
            Re-run starts a new campaign in {MODE_LABELS[mode]} mode.
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Estimated full run with one Vision QA retry per shot:{" "}
          <span className="font-mono text-foreground/80">
            {formatCost(estimatedWorstCaseUsd)}
          </span>
          . Every media call is checked against the campaign cap before it
          runs.
        </p>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-2.5 text-[12px] leading-relaxed text-rose-100">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <p className="font-medium text-rose-100">Last run stopped</p>
                <p className="mt-1 text-rose-100/80">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <LiveRunDialog execution={execution} />
    </Card>
  );
}
