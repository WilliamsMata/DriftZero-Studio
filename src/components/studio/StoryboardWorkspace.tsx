"use client";

import {
  BadgeCheck,
  ChevronDown,
  Clapperboard,
  Dna,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Package,
  Scan,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/store/use-studio-store";
import type {
  AspectRatio,
  ShotPlan,
  ShotResult,
} from "@/domain/entities/campaign";
import {
  SHOT_ROLE_LABELS,
  STEP_META,
  TONE_LABELS,
  VIDEO_STATUS_META,
  formatCost,
  isStudioBusy,
  shortJobId,
} from "@/lib/studio-utils";

const FALLBACK_SHOTS: readonly ShotPlan[] = [
  {
    index: 1,
    role: "hero-packshot",
    title: "Hero Packshot",
    imagePrompt:
      "Waiting for the creative director to write the hero packshot prompt.",
    videoMotionPrompt:
      "Waiting for the creative director to write the hero motion prompt.",
  },
  {
    index: 2,
    role: "lifestyle-context",
    title: "Lifestyle Context",
    imagePrompt:
      "Waiting for the creative director to write the lifestyle prompt.",
    videoMotionPrompt:
      "Waiting for the creative director to write the lifestyle motion prompt.",
  },
  {
    index: 3,
    role: "macro-finale",
    title: "Macro Finale",
    imagePrompt:
      "Waiting for the creative director to write the macro finale prompt.",
    videoMotionPrompt:
      "Waiting for the creative director to write the macro motion prompt.",
  },
];

function ShotRoleIcon({ role }: { role: ShotPlan["role"] }) {
  if (role === "hero-packshot") return <Package className="size-3.5" />;
  if (role === "lifestyle-context") return <MapPin className="size-3.5" />;
  return <Scan className="size-3.5" />;
}

function AdCopyField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-9 resize-none bg-white/[0.02] text-base sm:text-xs"
      />
    </div>
  );
}

function ShotCard({
  shot,
  result,
  productImageUrl,
  generating,
  aspectRatio,
  estimatedFrameCostUsd,
}: {
  shot: ShotPlan;
  result: ShotResult | undefined;
  productImageUrl: string;
  generating: boolean;
  aspectRatio: AspectRatio;
  estimatedFrameCostUsd: number;
}) {
  const keyframeUrl = result?.keyframeUrl ?? "";
  const hasKeyframe = keyframeUrl.trim() !== "";
  const showSplit =
    hasKeyframe && productImageUrl.trim() !== "";

  const videoStatus = result?.videoStatus ?? "idle";
  const videoMeta = VIDEO_STATUS_META[videoStatus];
  const progress = Math.min(Math.max(result?.videoProgress ?? 0, 0), 100);

  const fidelityScore = result?.fidelityScore ?? 0;
  const wasRetried = result?.wasRetried ?? false;
  const fidelityClass = wasRetried
    ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
    : fidelityScore >= 8
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
      : fidelityScore >= 7
        ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
        : "border-rose-400/30 bg-rose-400/15 text-rose-100";

  return (
    <Card className="group/card gap-0 overflow-hidden border-white/5 bg-card/65 py-0 ring-1 ring-white/10 transition-colors hover:ring-white/20">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-amber-200/80">
            <ShotRoleIcon role={shot.role} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.12em] text-amber-300/80">
                SHOT 0{shot.index}
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

      <div aria-hidden={false} className="relative mt-3">
        {showSplit ? (
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
        ) : (
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
        )}
      </div>

      {result && hasKeyframe ? (
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge
              variant="outline"
              className={cn(
                "h-6 gap-1 px-2 text-[11px] font-medium",
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
            <span className="text-[12px] font-medium text-foreground/85">
              {wasRetried ? "Repaired after one retry" : "First pass, no drift"}
            </span>
            <span
              className="ml-auto font-mono text-[11px] text-muted-foreground"
              title="Estimated image cost for this frame from the selected model; the ledger holds settled spend."
            >
              {formatCost(estimatedFrameCostUsd)} est.
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {result.qaFeedback.trim() !== ""
              ? result.qaFeedback
              : "No Vision QA feedback was recorded for this frame."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2.5 px-3 py-3">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              <Film className="size-3" />
              Video Render
            </span>
          </div>
          <Progress
            value={progress}
            aria-label={`Shot ${shot.index} video render progress`}
            className="mt-2 [&_[data-slot=progress-track]]:h-1.5"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>{Math.round(progress)}%</span>
            <span className="truncate" title={result?.videoJobId}>
              {shortJobId(result?.videoJobId)}
            </span>
          </div>
        </div>

        <details className="group/prompt border-t border-white/[0.06] pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground">
            Prompt engineering
            <ChevronDown className="size-3 transition-transform group-open/prompt:rotate-180" />
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-amber-200 uppercase">
                Image prompt
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {shot.imagePrompt}
              </p>
            </div>
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

      <div className="sr-only">
        {aspectRatio} storyboard shot {shot.index}
      </div>
    </Card>
  );
}

export function StoryboardWorkspace() {
  const campaign = useStudioStore((state) => state.campaign);
  const tone = useStudioStore((state) => state.tone);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const product = useStudioStore((state) => state.product);
  const activeStep = useStudioStore((state) => state.activeStep);
  const presets = useStudioStore((state) => state.presets);
  const imageModels = useStudioStore((state) => state.imageModels);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const loadPreset = useStudioStore((state) => state.loadPreset);
  const updateAdCopy = useStudioStore((state) => state.updateAdCopy);

  const busy = isStudioBusy(activeStep);
  const planning = activeStep === "planning";
  const keyframesGenerating = activeStep === "keyframes";
  const firstPreset = presets[0];
  const estimatedFrameCostUsd =
    imageModels.find((model) => model.id === selectedImageModel)
      ?.estimatedCostPerImageUsd ?? 0;

  const displayTone = campaign?.tone ?? tone;
  const displayAspectRatio = campaign?.aspectRatio ?? aspectRatio;
  const displayProductImage = campaign?.product.imageUrl ?? product.imageUrl;

  const keyframeCount =
    campaign?.results.filter((result) => result.keyframeUrl.trim() !== "")
      .length ?? 0;
  const readyClipCount =
    campaign?.results.filter((result) => result.videoStatus === "completed")
      .length ?? 0;

  return (
    <div id="storyboard" tabIndex={-1} className="space-y-4 outline-none">
      <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
        <CardHeader className="border-b border-white/5 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex size-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <Clapperboard className="size-3.5" />
                </span>
                Creative Director Brief
              </CardTitle>
              <CardDescription className="mt-1 text-[12px]">
                Product DNA, edit-ready ad copy, and the three-shot plan. Every
                frame is scored against the anchor.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-6 border-amber-300/20 bg-amber-300/[0.06] px-2 text-[11px] text-amber-100/80"
              >
                {TONE_LABELS[displayTone]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-4 py-4">
          <div className="relative overflow-hidden rounded-xl border border-amber-300/15 bg-gradient-to-r from-amber-300/[0.08] via-amber-300/[0.025] to-transparent p-3">
            <div className="absolute -top-10 -right-8 size-28 rounded-full bg-amber-300/10 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-amber-200 uppercase">
                  <Dna className="size-3.5" />
                  Product DNA
                </span>
                <Badge
                  variant="outline"
                  className="h-6 border-amber-300/25 bg-amber-300/10 px-2 text-[11px] font-normal text-amber-100/85"
                  title="The product anchor is passed into every keyframe as a reference image."
                >
                  <ShieldCheck className="size-3" />
                  Anchor locked
                </Badge>
                {campaign ? (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {campaign.product.name}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-amber-50/90">
                {campaign?.productDna ??
                  "Run the creative director to extract exact product geometry, label typography, materials, and lighting cues for zero-drift generation."}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <AdCopyField
              id="ad-hook"
              label="Hook"
              value={campaign?.adCopy.hook ?? ""}
              placeholder="Scroll-stopping first line"
              maxLength={140}
              disabled={!campaign}
              onChange={(value) => updateAdCopy("hook", value)}
            />
            <AdCopyField
              id="ad-headline"
              label="Headline"
              value={campaign?.adCopy.headline ?? ""}
              placeholder="Product promise"
              maxLength={160}
              disabled={!campaign}
              onChange={(value) => updateAdCopy("headline", value)}
            />
            <AdCopyField
              id="ad-cta"
              label="CTA"
              value={campaign?.adCopy.cta ?? ""}
              placeholder="Shop the drop"
              maxLength={40}
              disabled={!campaign}
              onChange={(value) => updateAdCopy("cta", value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Ad copy syncs live to the safe-zone preview.
            </span>
            {campaign ? (
              <span className="font-mono">
                {formatCost(campaign.ledger.totalUsd)} campaign spend
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {campaign === null ? (
        <Card className="gap-0 overflow-hidden border-white/5 bg-card/40 py-0 ring-1 ring-white/10">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-9 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.12)]">
              {planning ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Clapperboard className="size-5" />
              )}
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                {planning
                  ? "The creative director is writing your blueprint"
                  : "Your storyboard is waiting for direction"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
                {planning
                  ? STEP_META.planning.description
                  : "Load a pre-baked showcase campaign for a zero-wait demo, or configure a product anchor and run the full pipeline."}
              </p>
            </div>
            {!planning && firstPreset ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadPreset(firstPreset.id)}
                className="border-amber-300/25 bg-amber-300/[0.06] text-amber-100 hover:bg-amber-300/10"
              >
                <Sparkles className="size-3.5" />
                Load {firstPreset.name}
              </Button>
            ) : null}
            {!planning && activeStep === "error" ? (
              <span className="flex items-center gap-1.5 text-[12px] text-rose-200">
                <TriangleAlert className="size-3.5" />
                The last run stopped before a storyboard was created.
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            3-Shot Storyboard
          </h2>
          <p
            className="mt-0.5 text-[12px] text-muted-foreground"
            aria-live="polite"
          >
            {keyframeCount}/3 keyframes · {readyClipCount}/3 clips ready
            {busy ? " · pipeline running" : ""}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Vision QA scores each keyframe against the anchor; one repair pass
            maximum.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="h-6 border-white/10 bg-white/[0.03] px-2 text-[11px] text-muted-foreground"
          >
            <ShieldCheck className="size-3 text-emerald-300" />
            Zero-drift QA
          </Badge>
          <Badge
            variant="outline"
            className="h-6 border-white/10 bg-white/[0.03] px-2 font-mono text-[11px] text-muted-foreground"
          >
            {displayAspectRatio}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {FALLBACK_SHOTS.map((fallbackShot) => {
          const shot =
            campaign?.shots.find(
              (candidate) => candidate.index === fallbackShot.index,
            ) ?? fallbackShot;
          const result = campaign?.results.find(
            (candidate) => candidate.shotIndex === shot.index,
          );

          return (
            <ShotCard
              key={shot.index}
              shot={shot}
              result={result}
              productImageUrl={displayProductImage}
              generating={keyframesGenerating && !result?.keyframeUrl}
              aspectRatio={displayAspectRatio}
              estimatedFrameCostUsd={estimatedFrameCostUsd}
            />
          );
        })}
      </div>
    </div>
  );
}
