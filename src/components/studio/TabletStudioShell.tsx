"use client";

import type { ReactNode } from "react";
import {
  Aperture,
  Clapperboard,
  Play,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CampaignConfigPanel,
  ExecutionPanel,
} from "@/components/studio/CampaignConfigPanel";
import { DirectorBriefCard } from "@/components/studio/DirectorBriefCard";
import {
  buildFallbackShots,
  ShotStoryboardCard,
} from "@/components/studio/ShotStoryboardCard";
import { CommercialPlayerStage } from "@/components/studio/CommercialPlayerStage";
import { FinOpsLedgerCard } from "@/components/studio/FinOpsLedgerCard";
import { useStudioStore } from "@/store/use-studio-store";
import type { ExecutionMode } from "@/domain/entities/campaign";
import {
  formatUsd,
  isStudioBusy,
} from "@/lib/studio-utils";
import { useStudioBudgetSummary } from "@/components/studio/studio-primitives";

const MODE_OPTIONS: ReadonlyArray<{
  value: ExecutionMode;
  label: string;
  activeClassName: string;
}> = [
  {
    value: "mock",
    label: "Mock",
    activeClassName:
      "border-emerald-400/30 bg-emerald-400/15 text-emerald-100",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    activeClassName: "border-amber-400/30 bg-amber-400/15 text-amber-100",
  },
  {
    value: "live",
    label: "Live",
    activeClassName: "border-rose-400/30 bg-rose-400/15 text-rose-100",
  },
];

function TabletStoryboard() {
  const campaign = useStudioStore((state) => state.campaign);
  const product = useStudioStore((state) => state.product);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const activeStep = useStudioStore((state) => state.activeStep);
  const presets = useStudioStore((state) => state.presets);
  const shotCount = useStudioStore((state) => state.shotCount);
  const loadPreset = useStudioStore((state) => state.loadPreset);
  const imageModels = useStudioStore((state) => state.imageModels);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );

  const busy = isStudioBusy(activeStep);
  const keyframesGenerating = activeStep === "keyframes";
  const firstPreset = presets[0];
  const displayAspectRatio = campaign?.aspectRatio ?? aspectRatio;
  const displayProductImage = campaign?.product.imageUrl ?? product.imageUrl;
  const displayShots = campaign?.shots ?? buildFallbackShots(shotCount);
  const displayShotCount = displayShots.length;
  const estimatedFrameCostUsd =
    imageModels.find((model) => model.id === selectedImageModel)
      ?.estimatedCostPerImageUsd ?? 0;

  const keyframeCount =
    campaign?.results.filter((result) => result.keyframeUrl.trim() !== "")
      .length ?? 0;
  const readyClipCount =
    campaign?.results.filter((result) => result.videoStatus === "completed")
      .length ?? 0;

  return (
    <div className="space-y-3 p-3">
      <DirectorBriefCard />

      {campaign === null ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-7 text-center">
          <Clapperboard className="mx-auto size-5 text-amber-200/80" />
          <p className="mt-2 text-sm font-semibold">
            The storyboard is waiting for direction
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Load a showcase campaign or run the pipeline from the left column.
            The shots populate here with the anchor comparison and Vision QA
            notes.
          </p>
          {firstPreset ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => loadPreset(firstPreset.id)}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-3 text-[12px] font-medium text-amber-100 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              Load {firstPreset.name}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            {displayShotCount}-Shot Storyboard
          </h2>
          <p
            className="mt-0.5 text-[12px] text-muted-foreground"
            aria-live="polite"
          >
            {keyframeCount}/{displayShotCount} keyframes · {readyClipCount}/
            {displayShotCount} clips ready
            {busy ? " · pipeline running" : ""}
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-6 border-white/10 bg-white/[0.03] px-2 font-mono text-[11px] text-muted-foreground"
        >
          {displayAspectRatio}
        </Badge>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pt-1 pb-2 contain-paint lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
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
              className="w-[300px] shrink-0 snap-center lg:w-auto lg:min-w-0"
            >
              <ShotStoryboardCard
                shot={shot}
                result={result}
                productImageUrl={displayProductImage}
                generating={
                  keyframesGenerating && !result?.keyframeUrl
                }
                aspectRatio={displayAspectRatio}
                estimatedFrameCostUsd={estimatedFrameCostUsd}
                variant="desktop"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabletTopBar() {
  const mode = useStudioStore((state) => state.mode);
  const setMode = useStudioStore((state) => state.setMode);
  const presets = useStudioStore((state) => state.presets);
  const loadPreset = useStudioStore((state) => state.loadPreset);
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);
  const setTabletRightTab = useStudioStore(
    (state) => state.setTabletRightTab,
  );
  const { totalUsd, budgetCap } = useStudioBudgetSummary();

  const busy = isStudioBusy(activeStep);
  const presetItems = Object.fromEntries(
    presets.map((preset) => [preset.id, preset.name]),
  ) as Record<string, string>;
  const activePresetId =
    presets.find((preset) => preset.campaign.id === campaign?.id)?.id ?? "";

  return (
    <header className="shrink-0 border-b border-white/10 bg-background/95 px-4 py-2.5 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 text-zinc-950 ring-1 ring-white/30">
            <Aperture className="size-4" strokeWidth={2.2} />
            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background bg-emerald-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              DriftZero Studio
            </p>
            <p className="truncate text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Zero-drift ad pipeline
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Select
            value={activePresetId}
            items={presetItems}
            disabled={busy || presets.length === 0}
            onValueChange={(value) => {
              if (typeof value === "string" && value !== "") {
                loadPreset(value);
              }
            }}
          >
            <SelectTrigger
              aria-label="Load a showcase preset"
              className="h-11 min-w-[164px] bg-white/[0.02] text-[12px] data-[size=default]:h-11"
            >
              <SelectValue placeholder="Showcase preset" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            role="group"
            aria-label="Execution mode for the next run"
            className="flex items-center rounded-lg border border-white/10 bg-zinc-950/70 p-0.5"
          >
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
                    "min-h-11 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                    active
                      ? option.activeClassName
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setTabletRightTab("player")}
            aria-label={`Open FinOps ledger. ${formatUsd(
              totalUsd,
            )} spent of ${formatUsd(budgetCap)}.`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 font-mono text-[11px] text-foreground"
          >
            <Wallet className="size-3.5 text-emerald-300" />
            {formatUsd(totalUsd)} / {formatUsd(budgetCap)}
          </button>
        </div>
      </div>
    </header>
  );
}

function TabletTabs() {
  const tabletRightTab = useStudioStore((state) => state.tabletRightTab);
  const setTabletRightTab = useStudioStore(
    (state) => state.setTabletRightTab,
  );

  const tabs: ReadonlyArray<{
    id: "storyboard" | "player";
    label: string;
    icon: ReactNode;
  }> = [
    {
      id: "storyboard",
      label: "Director & Storyboard",
      icon: <Clapperboard className="size-3.5" />,
    },
    {
      id: "player",
      label: "Commercial Player & FinOps",
      icon: <Play className="size-3.5" />,
    },
  ];

  return (
    <div className="shrink-0 border-b border-white/10 px-4 py-2">
      <div
        role="tablist"
        aria-label="Tablet workspace sections"
        className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-zinc-950/60 p-1"
      >
        {tabs.map((tab) => {
          const active = tabletRightTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabletRightTab(tab.id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors",
                active
                  ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                  : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabletStudioShell() {
  const tabletRightTab = useStudioStore((state) => state.tabletRightTab);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-white/10 bg-background/60">
        <div className="min-h-0 flex-1 overflow-y-auto p-3 studio-scrollbar">
          <CampaignConfigPanel variant="touch" showBudgetGuardrail={false} />
        </div>
        <div className="shrink-0 border-t border-white/10 bg-background/95 p-3 backdrop-blur">
          <ExecutionPanel touch />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <TabletTopBar />
        <TabletTabs />

        <main
          id="studio-main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain studio-scrollbar"
        >
          {tabletRightTab === "storyboard" ? (
            <div id="storyboard" tabIndex={-1} className="outline-none">
              <TabletStoryboard />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <CommercialPlayerStage variant="desktop" />
              <FinOpsLedgerCard variant="mobile" showBudgetCap />
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
