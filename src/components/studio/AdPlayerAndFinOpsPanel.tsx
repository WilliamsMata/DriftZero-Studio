"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Bookmark,
  Clapperboard,
  Film,
  Heart,
  ImageIcon,
  Loader2,
  MessageCircle,
  Music2,
  Pause,
  Play,
  ReceiptText,
  Share2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useStudioStore } from "@/store/use-studio-store";
import type {
  AspectRatio,
  CampaignState,
  ShotResult,
} from "@/domain/entities/campaign";
import {
  COST_STEP_LABELS,
  MODE_LABELS,
  TOTAL_MEDIA_BUDGET_USD,
  VIDEO_STATUS_META,
  formatCost,
  formatUsd,
  isStudioBusy,
  shortJobId,
  toBrandHandle,
} from "@/lib/studio-utils";

const EMPTY_RESULTS: readonly ShotResult[] = [];

function playerFrameClass(ratio: AspectRatio): string {
  switch (ratio) {
    case "9:16":
      return "aspect-[9/16] w-full max-w-[280px]";
    case "16:9":
      return "aspect-video w-full";
    case "1:1":
      return "aspect-square w-full max-w-[320px]";
  }
}

function AdAction({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 drop-shadow-md">
      <span className="flex size-7 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-[2px]">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-white/90">{label}</span>
    </div>
  );
}

function AdSafeZoneOverlay({ campaign }: { campaign: CampaignState }) {
  const { adCopy, product } = campaign;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden text-white">
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/35" />

      <div className="absolute inset-x-3 top-[10%] border-t border-dashed border-white/45">
        <span className="absolute -top-2.5 left-0 rounded-sm bg-black/45 px-1 py-0.5 text-[11px] font-medium tracking-[0.12em] text-white/70 uppercase backdrop-blur-sm">
          Top safe zone
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-[21%] border-t border-dashed border-white/45">
        <span className="absolute -top-2.5 left-0 rounded-sm bg-black/45 px-1 py-0.5 text-[11px] font-medium tracking-[0.12em] text-white/70 uppercase backdrop-blur-sm">
          Bottom safe zone
        </span>
      </div>

      <div className="absolute top-[12%] left-2.5 flex max-w-[72%] items-center gap-1.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-[11px] font-bold text-zinc-950 ring-2 ring-white/75">
          DZ
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-tight">
            {product.name}
          </p>
          <p className="truncate text-[11px] text-white/75">
            Sponsored · {product.category}
          </p>
        </div>
      </div>

      <div className="absolute top-[47%] right-2 flex -translate-y-1/2 flex-col items-center gap-2.5">
        <AdAction icon={<Heart className="size-4 fill-white" />} label="128K" />
        <AdAction
          icon={<MessageCircle className="size-4 fill-white" />}
          label="2.4K"
        />
        <AdAction icon={<Bookmark className="size-4 fill-white" />} label="892" />
        <AdAction icon={<Share2 className="size-4" />} label="Share" />
      </div>

      <div className="absolute right-10 bottom-[23%] left-2.5 space-y-1.5">
        <p className="text-[11px] font-semibold tracking-wide text-white/85">
          {toBrandHandle(product.name)}
        </p>
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug drop-shadow-md">
          {adCopy.hook}
        </p>
        <p className="line-clamp-2 text-[12px] leading-snug text-white/90">
          {adCopy.headline}
        </p>
        <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-zinc-950 shadow-lg">
          {adCopy.cta}
          <ArrowRight className="size-2.5" strokeWidth={2.5} />
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-1.5 flex items-center gap-1.5 text-[11px] text-white/75">
        <Music2 className="size-2.5" />
        Original audio · DriftZero Sound
      </div>
    </div>
  );
}

export function AdPlayerAndFinOpsPanel() {
  const campaign = useStudioStore((state) => state.campaign);
  const configAspectRatio = useStudioStore((state) => state.aspectRatio);
  const configMaxBudgetUsd = useStudioStore(
    (state) => state.maxBudgetUsd,
  );
  const showAdOverlay = useStudioStore((state) => state.showAdOverlay);
  const setShowAdOverlay = useStudioStore(
    (state) => state.setShowAdOverlay,
  );
  const activePlayerShot = useStudioStore(
    (state) => state.activePlayerShot,
  );
  const setActivePlayerShot = useStudioStore(
    (state) => state.setActivePlayerShot,
  );
  const mode = useStudioStore((state) => state.mode);
  const activeStep = useStudioStore((state) => state.activeStep);
  const runMode = campaign?.mode ?? mode;

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const results = campaign?.results ?? EMPTY_RESULTS;
  const keyframeResults = useMemo(
    () => results.filter((result) => result.keyframeUrl.trim() !== ""),
    [results],
  );

  const activeResult = results.find(
    (result) => result.shotIndex === activePlayerShot,
  );
  const currentVideoUrl =
    activeResult?.videoStatus === "completed"
      ? activeResult.videoPlaybackUrl
      : undefined;
  const currentKeyframeUrl = activeResult?.keyframeUrl ?? "";
  const currentVideoStatus = activeResult?.videoStatus ?? "idle";
  const currentVideoMeta = VIDEO_STATUS_META[currentVideoStatus];

  const readyVideoCount = results.filter(
    (result) => result.videoStatus === "completed",
  ).length;
  const keyframeCount = keyframeResults.length;
  const playable = currentVideoUrl !== undefined || currentKeyframeUrl !== "";

  const displayAspectRatio =
    campaign?.aspectRatio ?? configAspectRatio;
  const overallStatus =
    readyVideoCount === 3
      ? "Sequence ready"
      : keyframeCount > 0
        ? "Keyframe preview"
        : "Awaiting render";
  const overallStatusClass =
    readyVideoCount === 3
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : keyframeCount > 0
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : "border-white/10 bg-white/[0.03] text-muted-foreground";

  const busy = isStudioBusy(activeStep);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        void playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      video.pause();
    }
  }, [activePlayerShot, currentVideoUrl, isPlaying]);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (
      currentVideoUrl ||
      !isPlaying ||
      keyframeResults.length <= 1 ||
      reduceMotion
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentIndex = keyframeResults.findIndex(
        (result) => result.shotIndex === activePlayerShot,
      );
      const nextResult =
        keyframeResults[(currentIndex + 1) % keyframeResults.length];
      if (nextResult) {
        setActivePlayerShot(nextResult.shotIndex);
      }
    }, 2600);

    return () => window.clearInterval(timer);
  }, [
    activePlayerShot,
    currentVideoUrl,
    isPlaying,
    keyframeResults,
    setActivePlayerShot,
  ]);

  function goToNextShot() {
    const next: 1 | 2 | 3 =
      activePlayerShot === 3 ? 1 : activePlayerShot === 2 ? 3 : 2;
    setActivePlayerShot(next);
  }

  function goToPreviousShot() {
    const previous: 1 | 2 | 3 =
      activePlayerShot === 1 ? 3 : activePlayerShot === 2 ? 1 : 2;
    setActivePlayerShot(previous);
  }

  const ledger = campaign?.ledger;
  const ledgerEntries = ledger?.entries ?? [];
  const totalUsd = ledger?.totalUsd ?? 0;
  const budgetCap = ledger?.maxBudgetUsd ?? configMaxBudgetUsd;
  const remainingUsd = Math.max(budgetCap - totalUsd, 0);
  const budgetPercent =
    budgetCap <= 0 ? 0 : Math.min((totalUsd / budgetCap) * 100, 100);
  const budgetBarClassName =
    budgetPercent >= 90
      ? "bg-rose-400"
      : budgetPercent >= 70
        ? "bg-amber-400"
        : "bg-emerald-400";

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
        <CardHeader className="border-b border-white/5 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex size-6 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300/10 text-sky-200">
                  <Play className="size-3.5 fill-current" />
                </span>
                Commercial Player
              </CardTitle>
              <CardDescription className="mt-1 text-[12px]">
                Sequential three-shot ad playback with live copy.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              role="status"
              aria-live="polite"
              className={cn(
                "h-6 shrink-0 gap-1.5 px-2 text-[11px] font-medium",
                overallStatusClass,
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  readyVideoCount === 3
                    ? "bg-emerald-300"
                    : keyframeCount > 0
                      ? "animate-pulse bg-amber-300"
                      : "bg-zinc-500",
                )}
              />
              {overallStatus}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 py-4">
          <div className="mx-auto flex w-full max-w-[360px] justify-center rounded-xl bg-zinc-950/60 p-2 ring-1 ring-white/5">
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-2xl",
                playerFrameClass(displayAspectRatio),
              )}
            >
              {currentVideoUrl ? (
                <video
                  key={`${activePlayerShot}-${currentVideoUrl}`}
                  ref={videoRef}
                  src={currentVideoUrl}
                  poster={
                    currentKeyframeUrl !== ""
                      ? currentKeyframeUrl
                      : undefined
                  }
                  className="h-full w-full object-cover"
                  muted={isMuted}
                  playsInline
                  preload="metadata"
                  aria-label={`Rendered commercial clip for shot ${activePlayerShot}`}
                  onEnded={goToNextShot}
                />
              ) : currentKeyframeUrl !== "" ? (
                // Dynamic generated previews intentionally use native img.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentKeyframeUrl}
                  alt={`Keyframe preview for shot ${activePlayerShot}`}
                  className="h-full w-full object-cover"
                />
              ) : campaign ? (
                <div className="relative h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={campaign.product.imageUrl}
                    alt={campaign.product.name}
                    className="h-full w-full object-cover opacity-30 blur-sm"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    {busy ? (
                      <Loader2 className="size-5 animate-spin text-amber-300" />
                    ) : (
                      <Clapperboard className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-[11px] tracking-wide text-white/60 uppercase">
                      {busy ? "Rendering first frames" : "Awaiting media"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                  <Clapperboard className="size-5 text-muted-foreground" />
                  <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Load a preset to preview
                  </span>
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />

              <div className="pointer-events-none absolute top-2.5 right-2.5 z-30 flex items-center gap-1 rounded-md border border-white/10 bg-black/55 px-1.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
                {currentVideoUrl ? (
                  <Film className="size-2.5" />
                ) : (
                  <ImageIcon className="size-2.5" />
                )}
                {currentVideoUrl
                  ? "Rendered clip"
                  : currentKeyframeUrl !== ""
                    ? "Keyframe preview"
                    : "Awaiting media"}
              </div>

              {showAdOverlay && campaign ? (
                <AdSafeZoneOverlay campaign={campaign} />
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {([1, 2, 3] as const).map((shotIndex) => {
              const selected = activePlayerShot === shotIndex;
              const result = results.find(
                (candidate) => candidate.shotIndex === shotIndex,
              );
              const ready = result?.videoStatus === "completed";

              return (
                <button
                  key={shotIndex}
                  type="button"
                  onClick={() => setActivePlayerShot(shotIndex)}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1 rounded-md border text-[11px] font-medium transition-colors",
                    selected
                      ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                      : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  Shot {shotIndex}/3
                  {ready ? (
                    <span className="size-1 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous shot"
                onClick={goToPreviousShot}
                disabled={!campaign}
              >
                <SkipBack className="size-3.5" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsPlaying((value) => !value)}
                disabled={!playable}
                className="h-9 gap-1 px-2.5 text-[12px]"
              >
                {isPlaying ? (
                  <Pause className="size-3" />
                ) : (
                  <Play className="size-3" />
                )}
                {isPlaying ? "Pause" : "Play"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next shot"
                onClick={goToNextShot}
                disabled={!campaign}
              >
                <SkipForward className="size-3.5" />
              </Button>

              {currentVideoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={isMuted ? "Unmute preview" : "Mute preview"}
                  onClick={() => setIsMuted((value) => !value)}
                >
                  {isMuted ? (
                    <VolumeX className="size-3.5" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </Button>
              ) : null}
            </div>

            <div className="min-w-0 text-right">
              <p className="truncate text-[11px] text-muted-foreground">
                Shot {activePlayerShot}/3 ·{" "}
                {currentVideoUrl
                  ? "Rendered clip"
                  : currentKeyframeUrl !== ""
                    ? "Keyframe preview"
                    : "Awaiting media"}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {currentVideoUrl
                  ? shortJobId(activeResult?.videoJobId)
                  : currentVideoMeta.label}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium">
                Ad Safe-Zone &amp; Copy Overlay
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                TikTok / Reels chrome, safe-zone guides, and live ad copy.
                Engagement counts are illustrative, not measured results.
              </p>
            </div>
            <Switch
              checked={showAdOverlay}
              onCheckedChange={setShowAdOverlay}
              disabled={!campaign}
              aria-label="Toggle the ad safe-zone and copy overlay"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
        <CardHeader className="border-b border-white/5 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex size-6 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <ReceiptText className="size-3.5" />
                </span>
                FinOps Cost Ledger
              </CardTitle>
              <CardDescription className="mt-1 text-[12px]">
                Itemized spend, model IDs, and remaining guardrail.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-6 shrink-0 gap-1 px-2 text-[11px] font-medium",
                runMode === "mock"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : runMode === "hybrid"
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    : "border-rose-400/20 bg-rose-400/10 text-rose-200",
              )}
              title="The execution mode this campaign was produced in"
            >
              <Wallet className="size-2.5" />
              {MODE_LABELS[runMode]} run
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Total spend
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-amber-100">
                {formatCost(totalUsd)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Remaining
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-sm font-medium",
                  remainingUsd <= 0
                    ? "text-rose-300"
                    : budgetPercent >= 70
                      ? "text-amber-200"
                      : "text-emerald-200",
                )}
              >
                {formatCost(remainingUsd)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                Budget used ·{" "}
                <span className="font-mono text-foreground/80">
                  {formatUsd(totalUsd)} / {formatUsd(budgetCap)}
                </span>
              </span>
              <span className="font-mono">{Math.round(budgetPercent)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  budgetBarClassName,
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>

          <div className="max-h-[230px] overflow-y-auto rounded-lg border border-white/[0.07] studio-scrollbar">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                <tr className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="px-2.5 py-2 font-medium">Step</th>
                  <th className="px-2 py-2 font-medium">Model</th>
                  <th className="px-2.5 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2.5 py-6 text-center text-[12px] leading-relaxed text-muted-foreground"
                    >
                      No spend recorded yet. Run the pipeline or load a
                      showcase preset.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry, index) => (
                    <tr
                      key={`${entry.step}-${entry.model}-${index}`}
                      title={entry.note}
                      className="border-t border-white/[0.05] text-[11px] transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                        {COST_STEP_LABELS[entry.step]}
                      </td>
                      <td className="max-w-[150px] truncate px-2 py-1.5 font-mono text-[11px] text-foreground/70">
                        {entry.model}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-mono text-[11px] text-amber-100/85">
                        {formatCost(entry.costUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.025] text-[11px]">
                  <td className="px-2.5 py-2 font-medium" colSpan={2}>
                    Total
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono font-medium text-amber-100">
                    {formatCost(totalUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-300" />
            Every stage is pre-reserved against this campaign&apos;s{" "}
            {formatUsd(budgetCap)} cap and the{" "}
            {formatUsd(TOTAL_MEDIA_BUDGET_USD)} project media budget.{" "}
            {runMode === "mock"
              ? "Mock runs record $0.00 media cost."
              : "Video costs enter the ledger at submission and remain labeled as estimates until the provider settles."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
