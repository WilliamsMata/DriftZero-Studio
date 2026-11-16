"use client";

import {
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Aperture,
  Check,
  ChevronDown,
  Clapperboard,
  Film,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  Target,
  TriangleAlert,
  Wallet,
  WandSparkles,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { useStudioStore, type MobileStudioTab } from "@/store/use-studio-store";
import type { ExecutionMode } from "@/domain/entities/campaign";
import { ProductAnchorPicker } from "@/components/studio/ProductAnchorPicker";
import { CreativeDirectionControls } from "@/components/studio/CreativeDirectionControls";
import { ModelCapabilitiesSection } from "@/components/studio/ModelCapabilitiesSection";
import { DirectorBriefCard } from "@/components/studio/DirectorBriefCard";
import {
  buildFallbackShots,
  ShotStoryboardCard,
} from "@/components/studio/ShotStoryboardCard";
import { CommercialPlayerStage } from "@/components/studio/CommercialPlayerStage";
import { FinOpsLedgerCard } from "@/components/studio/FinOpsLedgerCard";
import {
  ExecutionStepButtons,
  LiveRunDialog,
  useStudioExecution,
  type StudioExecution,
} from "@/components/studio/ExecutionControls";
import {
  useStudioBudgetSummary,
  useStudioCostEstimate,
} from "@/components/studio/studio-primitives";
import {
  STEP_META,
  applyExecutionModeToEstimate,
  formatCost,
  formatUsd,
  isStudioBusy,
} from "@/lib/studio-utils";

const MODE_OPTIONS: ReadonlyArray<{
  value: ExecutionMode;
  label: string;
  description: string;
  dotClassName: string;
  activeClassName: string;
}> = [
  {
    value: "mock",
    label: "Mock $0.00",
    description: "Fully simulated media. Nothing is sent to OpenRouter.",
    dotClassName: "bg-emerald-300",
    activeClassName:
      "border-emerald-400/30 bg-emerald-400/15 text-emerald-100",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Real text and image calls; video renders stay mocked.",
    dotClassName: "bg-amber-300",
    activeClassName: "border-amber-400/30 bg-amber-400/15 text-amber-100",
  },
  {
    value: "live",
    label: "Live OpenRouter",
    description:
      "Real text, image, Vision QA, and video calls. The campaign cap still guards every step.",
    dotClassName: "bg-rose-300",
    activeClassName: "border-rose-400/30 bg-rose-400/15 text-rose-100",
  },
];

const MOBILE_TABS: ReadonlyArray<{
  id: MobileStudioTab;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "create",
    label: "Create",
    icon: <WandSparkles className="size-4" />,
  },
  {
    id: "storyboard",
    label: "Storyboard",
    icon: <Clapperboard className="size-4" />,
  },
  { id: "player", label: "Player", icon: <Play className="size-4" /> },
  { id: "finops", label: "FinOps", icon: <Wallet className="size-4" /> },
];

function modePillLabel(mode: ExecutionMode): string {
  if (mode === "mock") return "Mock $0";
  if (mode === "hybrid") return "Hybrid";
  return "Live";
}

function ProgressiveDisclosureEngineCard({
  onConfigure,
}: {
  onConfigure: () => void;
}) {
  const mode = useStudioStore((state) => state.mode);
  const campaign = useStudioStore((state) => state.campaign);
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const { imageModel, videoModel, durationSeconds, costEstimate } =
    useStudioCostEstimate();

  const runMode = campaign?.mode ?? mode;
  const cap = campaign?.ledger.maxBudgetUsd ?? maxBudgetUsd;
  const estimateUsd = applyExecutionModeToEstimate(
    costEstimate,
    runMode,
  ).totalUsd;
  const displayEstimateUsd =
    runMode === "mock" ? costEstimate.totalUsd : estimateUsd;

  return (
    <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
      <CardContent className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <Target className="size-3.5 text-amber-300" />
              Engine
            </p>
            <p className="mt-1 truncate text-[12px] font-medium text-foreground/90">
              {imageModel?.label ?? "Image model syncing…"}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {videoModel?.label ?? "Video model syncing…"}
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-7 shrink-0 border-amber-300/20 bg-amber-300/[0.06] px-2 font-mono text-[11px] text-amber-100"
          >
            {durationSeconds}s clips
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Est. full run
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-medium text-amber-200">
              {`~${formatCost(displayEstimateUsd)}`}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {runMode === "mock"
                ? "Live combo · mock run $0.00"
                : runMode === "hybrid"
                  ? "Hybrid excludes video"
                  : "Live estimate"}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Budget cap
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-medium text-foreground/85">
              {formatUsd(cap)}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onConfigure}
          className="min-h-11 w-full gap-2 border-white/10 bg-white/[0.02] text-[12px]"
        >
          <Settings2 className="size-3.5" />
          Configure Models
        </Button>
      </CardContent>
    </Card>
  );
}

function StoryboardDeck() {
  const campaign = useStudioStore((state) => state.campaign);
  const product = useStudioStore((state) => state.product);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const activeStep = useStudioStore((state) => state.activeStep);
  const shotCount = useStudioStore((state) => state.shotCount);
  const imageModels = useStudioStore((state) => state.imageModels);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const activePlayerShot = useStudioStore(
    (state) => state.activePlayerShot,
  );
  const setActivePlayerShot = useStudioStore(
    (state) => state.setActivePlayerShot,
  );

  const deckRef = useRef<HTMLDivElement | null>(null);
  const keyframesGenerating = activeStep === "keyframes";
  const displayAspectRatio = campaign?.aspectRatio ?? aspectRatio;
  const displayProductImage = campaign?.product.imageUrl ?? product.imageUrl;
  const displayShots = campaign?.shots ?? buildFallbackShots(shotCount);
  const displayShotCount = displayShots.length;
  const estimatedFrameCostUsd =
    imageModels.find((model) => model.id === selectedImageModel)
      ?.estimatedCostPerImageUsd ?? 0;

  function scrollToShot(index: number) {
    setActivePlayerShot(index);
    const container = deckRef.current;
    if (!container) return;

    const card = container.querySelector<HTMLElement>(
      `[data-shot-index="${index}"]`,
    );
    if (!card) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const nextLeft =
      container.scrollLeft +
      (cardRect.left - containerRect.left) -
      (container.clientWidth - cardRect.width) / 2;

    container.scrollTo({ left: nextLeft, behavior: "smooth" });
  }

  function handleDeckScroll() {
    const container = deckRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    let closest = activePlayerShot;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const card of container.querySelectorAll<HTMLElement>(
      "[data-shot-index]",
    )) {
      const cardRect = card.getBoundingClientRect();
      const distance = Math.abs(
        cardRect.left + cardRect.width / 2 - center,
      );
      const index = Number(card.dataset.shotIndex);

      if (distance < closestDistance && Number.isInteger(index)) {
        closest = index;
        closestDistance = distance;
      }
    }

    if (closest !== activePlayerShot) {
      setActivePlayerShot(closest);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            {displayShotCount}-Shot Storyboard
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Swipe the deck or tap a shot to jump.
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-6 border-white/10 bg-white/[0.03] px-2 font-mono text-[11px] text-muted-foreground"
        >
          {displayAspectRatio}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 px-4">
        {displayShots.map((shot) => {
          const selected = activePlayerShot === shot.index;

          return (
            <button
              key={shot.index}
              type="button"
              onClick={() => scrollToShot(shot.index)}
              aria-pressed={selected}
              className={cn(
                "min-h-11 flex-1 rounded-lg border px-2 text-[11px] font-medium transition-colors",
                selected
                  ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground",
              )}
            >
              Shot {String(shot.index).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      <div
        ref={deckRef}
        onScroll={handleDeckScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1 contain-paint [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {displayShots.map((fallbackShot) => {
          const shot =
            campaign?.shots.find(
              (candidate) => candidate.index === fallbackShot.index,
            ) ?? fallbackShot;
          const result = campaign?.results.find(
            (candidate) => candidate.shotIndex === shot.index,
          );

          return (
            <div
              key={shot.index}
              data-shot-index={shot.index}
              className="w-[88vw] max-w-[360px] shrink-0 snap-center"
            >
              <ShotStoryboardCard
                shot={shot}
                result={result}
                productImageUrl={displayProductImage}
                generating={keyframesGenerating && !result?.keyframeUrl}
                aspectRatio={displayAspectRatio}
                estimatedFrameCostUsd={estimatedFrameCostUsd}
                variant="mobile"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1 px-4">
        {displayShots.map((shot) => {
          const selected = activePlayerShot === shot.index;

          return (
            <button
              key={shot.index}
              type="button"
              onClick={() => scrollToShot(shot.index)}
              aria-label={`Go to shot ${shot.index}`}
              aria-pressed={selected}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span
                className={cn(
                  "rounded-full transition-all",
                  selected
                    ? "h-2 w-6 bg-amber-300"
                    : "size-2 bg-white/20",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileActionBar({
  execution,
  onWatchAd,
  onOpenSteps,
}: {
  execution: StudioExecution;
  onWatchAd: () => void;
  onOpenSteps: () => void;
}) {
  const mobileTab = useStudioStore((state) => state.mobileTab);
  const { totalUsd, budgetCap } = useStudioBudgetSummary();
  const { activeStep, campaign, busy } = execution;

  const readyVideoCount =
    campaign?.results.filter((result) => result.videoStatus === "completed")
      .length ?? 0;
  const allVideosReady =
    campaign !== null &&
    campaign.results.length > 0 &&
    readyVideoCount === campaign.results.length;
  const showWatchAd =
    activeStep === "completed" &&
    allVideosReady &&
    (mobileTab === "create" || mobileTab === "storyboard");

  const busyLabel =
    activeStep === "planning"
      ? "Planning brief…"
      : activeStep === "keyframes"
        ? "Generating keyframes & QA…"
        : activeStep === "submitting-videos"
          ? "Submitting clips…"
          : activeStep === "polling-videos"
            ? "Rendering clips…"
            : STEP_META[activeStep].label;

  const rerunLabel = campaign ? "Re-run" : "Run Full Pipeline";

  return (
    <div className="shrink-0 border-t border-white/10 bg-background/95 px-3 py-2 backdrop-blur">
      {busy ? (
        <div className="flex items-center gap-2">
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300/50" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
            </span>
            <span className="truncate text-[12px] font-medium text-amber-100">
              {busyLabel}
            </span>
          </div>
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
            {formatCost(totalUsd)} / {formatUsd(budgetCap)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {showWatchAd ? (
            <>
              <Button
                type="button"
                onClick={onWatchAd}
                className="min-h-11 min-w-0 flex-1 gap-1.5 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 text-[12px] font-semibold text-zinc-950"
              >
                <Play className="size-3.5 fill-current" />
                Watch Ad Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => execution.requestRun("full")}
                disabled={!execution.canPlan}
                className="min-h-11 shrink-0 px-3 text-[12px]"
              >
                Re-run
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => execution.requestRun("full")}
              disabled={!execution.canPlan}
              className="min-h-11 min-w-0 flex-1 gap-1.5 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 text-[12px] font-semibold text-zinc-950"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <WandSparkles className="size-4" />
              )}
              {rerunLabel}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onOpenSteps}
            aria-label="Open pipeline steps"
            className="min-h-11 shrink-0 gap-1.5 px-3 text-[12px]"
          >
            <Settings2 className="size-3.5" />
            Steps
          </Button>
        </div>
      )}
    </div>
  );
}

function MobileBottomNav() {
  const mobileTab = useStudioStore((state) => state.mobileTab);
  const setMobileTab = useStudioStore((state) => state.setMobileTab);
  const campaign = useStudioStore((state) => state.campaign);

  const keyframeCount =
    campaign?.results.filter((result) => result.keyframeUrl.trim() !== "")
      .length ?? 0;
  const readyClipCount =
    campaign?.results.filter((result) => result.videoStatus === "completed")
      .length ?? 0;
  const totalShots = campaign?.results.length ?? 0;
  const allClipsReady = totalShots > 0 && readyClipCount === totalShots;
  const allKeyframesReady = totalShots > 0 && keyframeCount === totalShots;

  return (
    <nav
      aria-label="Studio sections"
      className="shrink-0 border-t border-white/10 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="grid grid-cols-4">
        {MOBILE_TABS.map((tab) => {
          const active = mobileTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              aria-pressed={active}
              className={cn(
                "relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors",
                active
                  ? "text-amber-200"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                {tab.icon}
                {tab.id === "storyboard" && keyframeCount > 0 ? (
                  <span
                    className={cn(
                      "absolute -top-2 -right-3 rounded-full px-1 py-0.5 text-[9px] leading-none font-semibold",
                      allKeyframesReady
                        ? "bg-emerald-400 text-zinc-950"
                        : "bg-amber-300 text-zinc-950",
                    )}
                  >
                    {keyframeCount}/{totalShots}
                  </span>
                ) : null}
                {tab.id === "player" && allClipsReady ? (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full border border-background bg-emerald-400" />
                ) : null}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileStudioShell() {
  const mobileTab = useStudioStore((state) => state.mobileTab);
  const setMobileTab = useStudioStore((state) => state.setMobileTab);
  const mode = useStudioStore((state) => state.mode);
  const setMode = useStudioStore((state) => state.setMode);
  const presets = useStudioStore((state) => state.presets);
  const loadPreset = useStudioStore((state) => state.loadPreset);
  const catalogStatus = useStudioStore((state) => state.catalogStatus);
  const catalogError = useStudioStore((state) => state.catalogError);
  const loadInitialCatalog = useStudioStore(
    (state) => state.loadInitialCatalog,
  );
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);

  const execution = useStudioExecution();
  const { totalUsd, budgetCap } = useStudioBudgetSummary();

  const [presetDrawerOpen, setPresetDrawerOpen] = useState(false);
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false);
  const [stepsDrawerOpen, setStepsDrawerOpen] = useState(false);

  const busy = isStudioBusy(activeStep);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <header className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-background/95 px-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 text-zinc-950 shadow-[0_0_24px_rgba(251,191,36,0.2)] ring-1 ring-white/30">
            <Aperture className="size-4" strokeWidth={2.2} />
            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background bg-emerald-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              DriftZero
            </p>
            <p className="truncate text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Studio
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPresetDrawerOpen(true)}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-medium text-foreground disabled:opacity-50"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                mode === "mock"
                  ? "bg-emerald-300"
                  : mode === "hybrid"
                    ? "bg-amber-300"
                    : "bg-rose-300",
              )}
            />
            {modePillLabel(mode)}
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("finops")}
            aria-label={`Open FinOps ledger. ${formatUsd(
              totalUsd,
            )} spent of ${formatUsd(budgetCap)}.`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 font-mono text-[10px] font-medium text-foreground"
          >
            <Wallet className="size-3 text-emerald-300" />
            {formatUsd(totalUsd)} / {formatUsd(budgetCap)}
          </button>
        </div>
      </header>

      <main
        id="studio-main"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {mobileTab === "create" ? (
          <div className="space-y-4 px-4 py-4">
            <ProductAnchorPicker variant="touch" />
            <Separator className="bg-white/5" />
            <CreativeDirectionControls variant="touch" />
            <ProgressiveDisclosureEngineCard
              onConfigure={() => setModelDrawerOpen(true)}
            />
          </div>
        ) : null}

        {mobileTab === "storyboard" ? (
          <div className="space-y-3 py-4">
            <DirectorBriefCard variant="mobile" className="mx-4" />
            {campaign === null ? (
              <div className="mx-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center">
                <Clapperboard className="mx-auto size-5 text-amber-200/80" />
                <p className="mt-2 text-[12px] font-medium">
                  No storyboard yet
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Load a showcase preset from the mode pill or run the pipeline
                  from Create. Your shots will populate here live.
                </p>
              </div>
            ) : null}
            <StoryboardDeck />
          </div>
        ) : null}

        {mobileTab === "player" ? (
          <div className="px-3 py-3">
            <CommercialPlayerStage variant="mobile" />
            {campaign === null ? (
              <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-center text-[12px] leading-relaxed text-muted-foreground">
                Load a showcase preset from the mode pill to preview the
                sequential commercial with the Ad Safe-Zone overlay.
              </div>
            ) : null}
          </div>
        ) : null}

        {mobileTab === "finops" ? (
          <div className="px-3 py-3">
            <FinOpsLedgerCard variant="mobile" showBudgetCap />
          </div>
        ) : null}
      </main>

      <MobileActionBar
        execution={execution}
        onWatchAd={() => setMobileTab("player")}
        onOpenSteps={() => setStepsDrawerOpen(true)}
      />
      <MobileBottomNav />

      <LiveRunDialog execution={execution} />

      <Drawer
        open={presetDrawerOpen}
        onOpenChange={setPresetDrawerOpen}
        showSwipeHandle
      >
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Studio mode &amp; showcase</DrawerTitle>
            <DrawerDescription>
              Pick the execution mode for the next run, or load a completed
              showcase campaign to inspect the storyboard, player, and ledger
              immediately.
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 studio-scrollbar">
            <section className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <Sparkles className="size-3.5 text-amber-300" />
                Execution mode
              </p>
              <div className="grid gap-2">
                {MODE_OPTIONS.map((option) => {
                  const active = mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={busy}
                      aria-pressed={active}
                      onClick={() => setMode(option.value)}
                      className={cn(
                        "flex min-h-12 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                        active
                          ? option.activeClassName
                          : "border-white/10 bg-white/[0.02] text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          option.dotClassName,
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed opacity-80">
                          {option.description}
                        </span>
                      </span>
                      {active ? (
                        <Check className="ml-auto size-4 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <Separator className="bg-white/5" />

            <section className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <Clapperboard className="size-3.5 text-amber-300" />
                Showcase presets
              </p>

              {catalogStatus === "loading" ? (
                <div className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-[12px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-amber-300" />
                  Loading presets…
                </div>
              ) : null}

              {presets.map((preset) => {
                const active = campaign?.id === preset.campaign.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() => {
                      loadPreset(preset.id);
                      setPresetDrawerOpen(false);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                      active
                        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                        : "border-white/10 bg-white/[0.02] text-muted-foreground",
                    )}
                  >
                    <Film className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium">
                        {preset.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed opacity-80">
                        {preset.description}
                      </span>
                    </span>
                    {active ? (
                      <Check className="ml-auto size-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })}

              {catalogStatus === "error" ? (
                <div className="space-y-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-100/85">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <p>{catalogError ?? "The catalog is unavailable."}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadInitialCatalog()}
                    className="min-h-10 border-rose-300/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
                  >
                    Retry catalog
                  </Button>
                </div>
              ) : null}
            </section>
          </div>

          <DrawerFooter className="border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              onClick={() => setPresetDrawerOpen(false)}
              className="min-h-11 bg-amber-300 text-zinc-950 hover:bg-amber-200"
            >
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={modelDrawerOpen}
        onOpenChange={setModelDrawerOpen}
        showSwipeHandle
      >
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Configure models</DrawerTitle>
            <DrawerDescription>
              All four model routes, capability badges, clip length, and the
              full-run estimate live here. The panel scrolls independently so
              the Create tab stays fast.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 studio-scrollbar">
            <ModelCapabilitiesSection variant="touch" showHeading={false} />
          </div>
          <DrawerFooter className="border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              onClick={() => setModelDrawerOpen(false)}
              className="min-h-11 bg-amber-300 text-zinc-950 hover:bg-amber-200"
            >
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={stepsDrawerOpen}
        onOpenChange={setStepsDrawerOpen}
        showSwipeHandle
      >
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Pipeline steps</DrawerTitle>
            <DrawerDescription>
              Run the director, keyframes, and videos independently. Every step
              still checks the campaign budget guardrail before spending.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 studio-scrollbar">
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                activeStep === "error"
                  ? "border-rose-400/20 bg-rose-500/[0.07]"
                  : busy
                    ? "border-amber-400/20 bg-amber-400/[0.06]"
                    : "border-white/[0.07] bg-white/[0.02]",
              )}
            >
              {busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-amber-300" />
              ) : activeStep === "error" ? (
                <TriangleAlert className="size-4 shrink-0 text-rose-300" />
              ) : (
                <Sparkles className="size-4 shrink-0 text-amber-300" />
              )}
              <span className="min-w-0 flex-1 text-[12px] font-medium">
                {STEP_META[activeStep].label}
              </span>
            </div>

            <ExecutionStepButtons
              execution={execution}
              layout="stack"
              touch
            />

            {execution.errorMessage ? (
              <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[12px] leading-relaxed text-rose-100/85">
                {execution.errorMessage}
              </p>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Mock runs spend $0.00. Hybrid mocks video. Live mode confirms the
              estimate before every run.
            </p>
          </div>
          <DrawerFooter className="border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              onClick={() => setStepsDrawerOpen(false)}
              className="min-h-11 bg-amber-300 text-zinc-950 hover:bg-amber-200"
            >
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
