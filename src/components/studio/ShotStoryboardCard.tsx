"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Package,
  Scan,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Card,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AspectRatio,
  ShotPlan,
  ShotResult,
} from "@/domain/entities/campaign";
import {
  shotRoleForIndex,
  shotTitleForIndex,
} from "@/domain/entities/shot-sequence";
import {
  SHOT_ROLE_LABELS,
  VIDEO_STATUS_META,
  formatCost,
  shortJobId,
} from "@/lib/studio-utils";

export function buildFallbackShots(shotCount: number): ShotPlan[] {
  return Array.from({ length: shotCount }, (_, position): ShotPlan => {
    const index = position + 1;
    const role = shotRoleForIndex(index, shotCount);

    return {
      index,
      role,
      title: shotTitleForIndex(index, shotCount),
      imagePrompt: `Waiting for the creative director to write the ${role} keyframe prompt.`,
      videoMotionPrompt: `Waiting for the creative director to write the ${role} motion prompt.`,
    };
  });
}

type MobileImageStageMode = "keyframe" | "anchor" | "split";

function ShotRoleIcon({ role }: { role: ShotPlan["role"] }) {
  if (role === "hero-packshot") return <Package className="size-3.5" />;
  if (role === "lifestyle-context") return <MapPin className="size-3.5" />;
  return <Scan className="size-3.5" />;
}

function stageAspectClass(aspectRatio: AspectRatio): string {
  switch (aspectRatio) {
    case "9:16":
      return "aspect-[3/4]";
    case "16:9":
      return "aspect-video";
    case "1:1":
      return "aspect-square";
  }
}

function ShotHeader({
  shot,
  videoMeta,
}: {
  shot: ShotPlan;
  videoMeta: (typeof VIDEO_STATUS_META)[ShotResult["videoStatus"]];
}) {
  return (
    <div className="flex items-start justify-between gap-2 px-3 pt-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-amber-200/80">
          <ShotRoleIcon role={shot.role} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.12em] text-amber-300/80">
              SHOT {String(shot.index).padStart(2, '0')}
            </span>
            <Badge
              variant="outline"
              className="h-6 border-white/[0.08] bg-white/[0.02] px-1.5 text-[11px] font-normal text-muted-foreground"
            >
              {SHOT_ROLE_LABELS[shot.role]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs leading-tight font-medium">
            {shot.title}
          </p>
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "h-6 shrink-0 gap-1 px-2 text-[11px] font-medium",
          videoMeta.badgeClassName,
        )}
      >
        <span
          className={cn("size-1.5 rounded-full", videoMeta.dotClassName)}
        />
        {videoMeta.label}
      </Badge>
    </div>
  );
}

function DesktopImageStage({
  shot,
  keyframeUrl,
  productImageUrl,
  generating,
}: {
  shot: ShotPlan;
  keyframeUrl: string;
  productImageUrl: string;
  generating: boolean;
}) {
  const hasKeyframe = keyframeUrl.trim() !== "";
  const showSplit = hasKeyframe && productImageUrl.trim() !== "";

  if (showSplit) {
    return (
      <div className="grid grid-cols-2 border-y border-white/5 bg-zinc-950">
        <figure className="relative aspect-[3/4] overflow-hidden border-r border-white/10">
          {/* Dynamic fixture previews intentionally use native img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImageUrl}
            alt={`${shot.title} product anchor reference`}
            className="h-full w-full bg-zinc-950 object-contain"
          />
          <figcaption className="absolute top-2 left-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[11px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
            Anchor
          </figcaption>
        </figure>
        <figure className="relative aspect-[3/4] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={keyframeUrl}
            alt={`${shot.title} keyframe`}
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute top-2 right-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[11px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
            Keyframe
          </figcaption>
        </figure>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden border-y border-white/5 bg-zinc-950">
      {hasKeyframe ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={keyframeUrl}
            alt={`${shot.title} keyframe`}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
        </>
      ) : (
        <>
          <Skeleton className="absolute inset-0 rounded-none bg-white/[0.04]" />
          <div className="relative flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {generating ? (
              <Loader2 className="size-4 animate-spin text-amber-300" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            <span className="text-[12px] tracking-wide uppercase">
              {generating ? "Vision QA in progress" : "Awaiting keyframe"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function MobileImageStage({
  shot,
  keyframeUrl,
  productImageUrl,
  generating,
  aspectRatio,
}: {
  shot: ShotPlan;
  keyframeUrl: string;
  productImageUrl: string;
  generating: boolean;
  aspectRatio: AspectRatio;
}) {
  const [stageMode, setStageMode] =
    useState<MobileImageStageMode>("keyframe");
  const hasKeyframe = keyframeUrl.trim() !== "";
  const hasAnchor = productImageUrl.trim() !== "";
  const canSplit = hasKeyframe && hasAnchor;

  const effectiveMode: MobileImageStageMode =
    stageMode === "anchor" && hasAnchor
      ? "anchor"
      : stageMode === "split" && canSplit
        ? "split"
        : "keyframe";

  const modes: ReadonlyArray<{
    value: MobileImageStageMode;
    label: string;
    disabled: boolean;
  }> = [
    { value: "keyframe", label: "Keyframe", disabled: !hasKeyframe },
    { value: "anchor", label: "Anchor", disabled: !hasAnchor },
    { value: "split", label: "Split", disabled: !canSplit },
  ];

  return (
    <div className="space-y-2 px-3">
      <div
        role="group"
        aria-label={`Shot ${shot.index} image comparison mode`}
        className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-zinc-950/70 p-1"
      >
        {modes.map((mode) => {
          const selected = effectiveMode === mode.value;

          return (
            <button
              key={mode.value}
              type="button"
              disabled={mode.disabled}
              aria-pressed={selected}
              onClick={() => setStageMode(mode.value)}
              className={cn(
                "min-h-11 rounded-md border text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                selected
                  ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                  : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950",
          stageAspectClass(aspectRatio),
        )}
      >
        {effectiveMode === "split" ? (
          <div className="grid h-full grid-cols-2">
            <figure className="relative h-full overflow-hidden border-r border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productImageUrl}
                alt={`${shot.title} product anchor reference`}
                className="h-full w-full bg-zinc-950 object-contain"
              />
              <figcaption className="absolute top-2 left-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
                Anchor
              </figcaption>
            </figure>
            <figure className="relative h-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={keyframeUrl}
                alt={`${shot.title} keyframe`}
                className="h-full w-full object-cover"
              />
              <figcaption className="absolute top-2 right-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
                Keyframe
              </figcaption>
            </figure>
          </div>
        ) : effectiveMode === "anchor" && hasAnchor ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl}
              alt={`${shot.title} product anchor reference`}
              className="h-full w-full bg-zinc-950 object-contain"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
            <figcaption className="absolute top-2 left-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
              Anchor reference
            </figcaption>
          </>
        ) : hasKeyframe ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={keyframeUrl}
              alt={`${shot.title} keyframe`}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
            <figcaption className="absolute top-2 left-2 rounded-sm bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.1em] text-white uppercase backdrop-blur-sm">
              Keyframe
            </figcaption>
          </>
        ) : (
          <>
            <Skeleton className="absolute inset-0 rounded-none bg-white/[0.04]" />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {generating ? (
                <Loader2 className="size-5 animate-spin text-amber-300" />
              ) : (
                <ImageIcon className="size-5" />
              )}
              <span className="text-[12px] tracking-wide uppercase">
                {generating ? "Vision QA in progress" : "Awaiting keyframe"}
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                Tap Anchor to inspect the source product photo.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QaSummary({
  result,
  estimatedFrameCostUsd,
  touch,
}: {
  result: ShotResult;
  estimatedFrameCostUsd: number;
  touch: boolean;
}) {
  const wasRetried = result.wasRetried;
  const fidelityScore = result.fidelityScore;
  const fidelityClass = wasRetried
    ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
    : fidelityScore >= 8
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
      : fidelityScore >= 7
        ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
        : "border-rose-400/30 bg-rose-400/15 text-rose-100";

  const statusLabel = wasRetried
    ? "Repaired after one retry"
    : "First pass, no drift";
  const feedback =
    result.qaFeedback.trim() !== ""
      ? result.qaFeedback
      : "No Vision QA feedback was recorded for this frame.";

  const fidelityBadge = (
    <Badge
      variant="outline"
      className={cn(
        "h-6 shrink-0 gap-1 px-2 text-[11px] font-medium",
        fidelityClass,
      )}
    >
      {wasRetried ? (
        <Sparkles className="size-3" />
      ) : (
        <BadgeCheck className="size-3" />
      )}
      Vision QA {fidelityScore}/10
    </Badge>
  );

  if (!touch) {
    // Desktop keeps the original always-visible Vision QA repair notes.
    return (
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {fidelityBadge}
          <span className="text-[12px] font-medium text-foreground/85">
            {statusLabel}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {formatCost(estimatedFrameCostUsd)} est.
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {feedback}
        </p>
      </div>
    );
  }

  return (
    <details className="group/qa border-b border-white/[0.06] bg-white/[0.02]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2.5">
        {fidelityBadge}
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/85">
          {statusLabel}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/qa:rotate-180" />
      </summary>
      <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-2.5">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {feedback}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Estimated frame cost {formatCost(estimatedFrameCostUsd)}. The FinOps
          ledger holds settled spend.
        </p>
      </div>
    </details>
  );
}

function ShotBody({
  shot,
  result,
  estimatedFrameCostUsd,
  touch,
}: {
  shot: ShotPlan;
  result: ShotResult | undefined;
  estimatedFrameCostUsd: number;
  touch: boolean;
}) {
  const progress = Math.min(Math.max(result?.videoProgress ?? 0, 0), 100);

  return (
    <div className="space-y-2.5 px-3 py-3">
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Film className="size-3" />
            Video Render
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress
          value={progress}
          aria-label={`Shot ${shot.index} video render progress`}
          className="mt-2 [&_[data-slot=progress-track]]:h-1.5"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
          <span title={!touch ? result?.videoJobId : undefined}>
            {shortJobId(result?.videoJobId)}
          </span>
          <span>
            {estimatedFrameCostUsd > 0
              ? `${formatCost(estimatedFrameCostUsd)} est. frame`
              : "Frame cost pending"}
          </span>
        </div>
      </div>

      <details className="group/prompt border-t border-white/[0.06] pt-2">
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors",
            touch && "min-h-11",
          )}
        >
          Prompt engineering
          <ChevronDown className="size-3 transition-transform group-open/prompt:rotate-180" />
        </summary>
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[11px] font-medium tracking-[0.12em] text-amber-200 uppercase">
              Creative direction
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {shot.imagePrompt}
            </p>
          </div>
          {result?.imagePromptUsed ? (
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-emerald-200 uppercase">
                Prompt sent
              </p>
              <p className="mt-0.5 max-h-56 overflow-y-auto text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {result.imagePromptUsed}
              </p>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-medium tracking-[0.12em] text-sky-200 uppercase">
              Motion prompt
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {shot.videoMotionPrompt}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

export interface ShotStoryboardCardProps {
  shot: ShotPlan;
  result?: ShotResult;
  productImageUrl: string;
  generating: boolean;
  aspectRatio: AspectRatio;
  estimatedFrameCostUsd: number;
  variant?: "desktop" | "mobile";
  className?: string;
}

export function ShotStoryboardCard({
  shot,
  result,
  productImageUrl,
  generating,
  aspectRatio,
  estimatedFrameCostUsd,
  variant = "desktop",
  className,
}: ShotStoryboardCardProps) {
  const keyframeUrl = result?.keyframeUrl ?? "";
  const hasKeyframe = keyframeUrl.trim() !== "";
  const videoStatus = result?.videoStatus ?? "idle";
  const videoMeta = VIDEO_STATUS_META[videoStatus];
  const isMobile = variant === "mobile";

  return (
    <Card
      className={cn(
        "group/card gap-0 overflow-hidden border-white/5 bg-card/65 py-0 ring-1 ring-white/10 transition-colors hover:ring-white/20",
        className,
      )}
    >
      <ShotHeader shot={shot} videoMeta={videoMeta} />

      <div className="relative mt-3">
        {isMobile ? (
          <MobileImageStage
            shot={shot}
            keyframeUrl={keyframeUrl}
            productImageUrl={productImageUrl}
            generating={generating}
            aspectRatio={aspectRatio}
          />
        ) : (
          <DesktopImageStage
            shot={shot}
            keyframeUrl={keyframeUrl}
            productImageUrl={productImageUrl}
            generating={generating}
          />
        )}
      </div>

      {result && hasKeyframe ? (
        <QaSummary
          result={result}
          estimatedFrameCostUsd={estimatedFrameCostUsd}
          touch={isMobile}
        />
      ) : null}

      <ShotBody
        shot={shot}
        result={result}
        estimatedFrameCostUsd={estimatedFrameCostUsd}
        touch={isMobile}
      />

      <div className="sr-only">
        {aspectRatio} storyboard shot {shot.index}
      </div>
    </Card>
  );
}
