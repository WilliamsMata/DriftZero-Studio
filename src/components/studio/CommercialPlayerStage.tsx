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
  Download,
  Heart,
  Loader2,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  VIDEO_STATUS_META,
  isStudioBusy,
  shortJobId,
  toBrandHandle,
  toDownloadFileName,
  toVideoDownloadHref,
} from "@/lib/studio-utils";

const EMPTY_RESULTS: readonly ShotResult[] = [];

function playerFrameClass(
  ratio: AspectRatio,
  variant: "desktop" | "mobile",
): string {
  if (variant === "mobile") {
    switch (ratio) {
      case "9:16":
        return "aspect-[9/16] h-[min(50dvh,480px)] w-auto max-w-full";
      case "16:9":
        return "aspect-video w-full max-h-[46dvh]";
      case "1:1":
        return "aspect-square w-full";
    }
  }

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
  compact = false,
}: {
  icon: ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 drop-shadow-md">
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-[2px] [&_svg]:shrink-0",
          compact ? "size-6 [&_svg]:size-3" : "size-7 [&_svg]:size-4",
        )}
      >
        {icon}
      </span>
      {compact ? null : (
        <span className="text-[11px] font-medium text-white/90">{label}</span>
      )}
    </div>
  );
}

function AdSafeZoneOverlay({
  campaign,
  compact,
  landscape,
}: {
  campaign: CampaignState;
  compact: boolean;
  landscape: boolean;
}) {
  const { adCopy, product } = campaign;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden text-white">
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

      <div
        className={cn(
          "absolute inset-x-3 border-t border-dashed border-white/45",
          landscape ? "top-[14%]" : "top-[9%]",
        )}
      >
        <span
          className={cn(
            "absolute right-0 bottom-full mb-1 rounded-sm bg-black/45 px-1 py-0.5 font-medium tracking-[0.14em] text-white/70 uppercase backdrop-blur-sm",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          Top safe zone
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-[20%] border-t border-dashed border-white/45">
        <span
          className={cn(
            "absolute top-full right-0 mt-1 rounded-sm bg-black/45 px-1 py-0.5 font-medium tracking-[0.14em] text-white/70 uppercase backdrop-blur-sm",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          Bottom safe zone
        </span>
      </div>

      <div
        className={cn(
          "absolute right-2.5 left-2.5 flex items-center gap-1.5",
          landscape ? "top-[18%]" : "top-[14%]",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 font-bold text-zinc-950 ring-2 ring-white/75",
            compact ? "size-[22px] text-[9px]" : "size-6 text-[11px]",
          )}
        >
          DZ
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-semibold leading-tight",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {product.name}
          </p>
          <p
            className={cn(
              "truncate text-white/75",
              compact ? "text-[10px]" : "text-[11px]",
            )}
          >
            Sponsored · {product.category}
          </p>
        </div>
      </div>

      {landscape ? null : (
        <div
          className={cn(
            "absolute right-1.5 flex -translate-y-1/2 flex-col items-center",
            compact ? "top-[43%] gap-2" : "top-[44%] gap-2.5",
          )}
        >
          <AdAction
            compact={compact}
            icon={<Heart className="fill-white" />}
            label="128K"
          />
          <AdAction
            compact={compact}
            icon={<MessageCircle className="fill-white" />}
            label="2.4K"
          />
          <AdAction
            compact={compact}
            icon={<Bookmark className="fill-white" />}
            label="892"
          />
          <AdAction compact={compact} icon={<Share2 />} label="Share" />
        </div>
      )}

      <div className="absolute right-2.5 bottom-[26%] left-2.5 space-y-1">
        <div
          className={cn(
            "space-y-1",
            landscape ? undefined : compact ? "pr-8" : "pr-10",
          )}
        >
          <p
            className={cn(
              "truncate font-semibold tracking-wide text-white/85",
              compact ? "text-[10px]" : "text-[11px]",
            )}
          >
            {toBrandHandle(product.name)}
          </p>
          <p
            className={cn(
              "font-semibold leading-snug drop-shadow-md",
              landscape ? "line-clamp-1" : "line-clamp-2",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {adCopy.hook}
          </p>
          {landscape ? null : (
            <p
              className={cn(
                "line-clamp-2 leading-snug text-white/90",
                compact ? "text-[11px]" : "text-[12px]",
              )}
            >
              {adCopy.headline}
            </p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-md bg-white font-semibold text-zinc-950 shadow-lg",
            compact ? "px-2 py-1 text-[10px]" : "px-2 py-1 text-[12px]",
          )}
        >
          <span className="min-w-0 truncate">{adCopy.cta}</span>
          <ArrowRight
            className={cn("shrink-0", compact ? "size-2.5" : "size-3")}
            strokeWidth={2.5}
          />
        </span>
      </div>

      <div
        className={cn(
          "absolute inset-x-2.5 bottom-1.5 flex items-center gap-1.5 text-white/75",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        <Music2 className={compact ? "size-2.5" : "size-3"} />
        Original audio · DriftZero Sound
      </div>
    </div>
  );
}

export interface CommercialPlayerStageProps {
  variant?: "desktop" | "mobile";
  className?: string;
}

export function CommercialPlayerStage({
  variant = "desktop",
  className,
}: CommercialPlayerStageProps) {
  const campaign = useStudioStore((state) => state.campaign);
  const configAspectRatio = useStudioStore((state) => state.aspectRatio);
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
  const activeStep = useStudioStore((state) => state.activeStep);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isMobile = variant === "mobile";
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
  const downloadUrl = currentVideoUrl
    ? toVideoDownloadHref(currentVideoUrl)
    : null;
  const downloadFileName =
    campaign && currentVideoUrl
      ? toDownloadFileName(campaign.product.name, activePlayerShot)
      : null;

  const readyVideoCount = results.filter(
    (result) => result.videoStatus === "completed",
  ).length;
  const keyframeCount = keyframeResults.length;
  const playable = currentVideoUrl !== undefined || currentKeyframeUrl !== "";
  const shotIndexes = useMemo(
    () =>
      results
        .map((result) => result.shotIndex)
        .sort((left, right) => left - right),
    [results],
  );
  const totalShots = shotIndexes.length;
  const allVideosReady = totalShots > 0 && readyVideoCount === totalShots;

  const displayAspectRatio = campaign?.aspectRatio ?? configAspectRatio;
  const overallStatus = allVideosReady
    ? "Sequence ready"
    : keyframeCount > 0
      ? "Keyframe preview"
      : "Awaiting render";
  const overallStatusClass = allVideosReady
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
    if (shotIndexes.length === 0) return;

    const currentPosition = shotIndexes.indexOf(activePlayerShot);
    const nextPosition =
      currentPosition === -1
        ? 0
        : (currentPosition + 1) % shotIndexes.length;
    const next = shotIndexes[nextPosition];

    if (next !== undefined) setActivePlayerShot(next);
  }

  function goToPreviousShot() {
    if (shotIndexes.length === 0) return;

    const currentPosition = shotIndexes.indexOf(activePlayerShot);
    const previousPosition =
      currentPosition <= 0
        ? shotIndexes.length - 1
        : currentPosition - 1;
    const previous = shotIndexes[previousPosition];

    if (previous !== undefined) setActivePlayerShot(previous);
  }

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm",
        className,
      )}
    >
      {!isMobile ? (
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
                Sequential storyboard playback with live copy.
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
                  allVideosReady
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
      ) : null}

      <CardContent
        className={cn(
          isMobile ? "space-y-2.5 px-3 py-2.5" : "space-y-3 px-4 py-4",
        )}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {overallStatus}
        </span>
        <div
          className={cn(
            "mx-auto flex w-full justify-center rounded-xl bg-zinc-950/60 ring-1 ring-white/5",
            isMobile ? "max-w-full p-1.5" : "max-w-[360px] p-2",
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-2xl",
              playerFrameClass(displayAspectRatio, variant),
            )}
          >
            {currentVideoUrl ? (
              <video
                key={`${activePlayerShot}-${currentVideoUrl}`}
                ref={videoRef}
                src={currentVideoUrl}
                poster={
                  currentKeyframeUrl !== "" ? currentKeyframeUrl : undefined
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

            {showAdOverlay && campaign ? (
              <AdSafeZoneOverlay
                campaign={campaign}
                compact={isMobile}
                landscape={displayAspectRatio === "16:9"}
              />
            ) : null}
          </div>
        </div>

        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(totalShots, 1)}, minmax(0, 1fr))`,
          }}
        >
          {shotIndexes.map((shotIndex) => {
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
                  "flex min-w-0 items-center justify-center gap-1 rounded-md border text-[11px] font-medium transition-colors",
                  isMobile ? "min-h-11" : "h-9",
                  selected
                    ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                    : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                Shot {shotIndex}/{totalShots}
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
              size={isMobile ? "default" : "icon-sm"}
              aria-label="Previous shot"
              onClick={goToPreviousShot}
              disabled={!campaign}
              className={cn(isMobile && "size-11")}
            >
              <SkipBack className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="secondary"
              size={isMobile ? "default" : "sm"}
              onClick={() => setIsPlaying((value) => !value)}
              disabled={!playable}
              className={cn(
                "gap-1",
                isMobile
                  ? "h-11 px-3 text-[12px]"
                  : "h-9 px-2.5 text-[12px]",
              )}
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
              size={isMobile ? "default" : "icon-sm"}
              aria-label="Next shot"
              onClick={goToNextShot}
              disabled={!campaign}
              className={cn(isMobile && "size-11")}
            >
              <SkipForward className="size-3.5" />
            </Button>

            {currentVideoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size={isMobile ? "default" : "icon-sm"}
                aria-label={isMuted ? "Unmute preview" : "Mute preview"}
                onClick={() => setIsMuted((value) => !value)}
                className={cn(isMobile && "size-11")}
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
              Shot {activePlayerShot}/{totalShots || "—"} ·{" "}
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

        {downloadUrl && downloadFileName ? (
          <a
            href={downloadUrl}
            download={downloadFileName}
            title={downloadFileName}
            className={cn(
              buttonVariants({
                variant: "outline",
                size: isMobile ? "lg" : "sm",
              }),
              "w-full justify-center gap-2 border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-100 hover:bg-emerald-400/10 hover:text-emerald-50",
              isMobile ? "h-11 text-[12px]" : "h-9 text-[11px]",
            )}
          >
            <Download className="size-3.5" />
            <span className="truncate">
              Download shot {activePlayerShot} clip
            </span>
            <span className="font-mono text-[10px] text-emerald-200/60">
              MP4
            </span>
          </a>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium">
              Ad Safe-Zone &amp; Copy Overlay
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {isMobile
                ? "TikTok / Reels chrome and live ad copy."
                : "TikTok / Reels chrome and live ad copy. Engagement counts are illustrative, not measured results."}
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
  );
}
