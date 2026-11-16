"use client";

import { useMemo } from "react";
import {
  Clapperboard,
  Coins,
  Eye,
  Film,
  ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Timer,
  TriangleAlert,
  Type,
  Volume2,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useStudioStore } from "@/store/use-studio-store";
import {
  CAPABILITY_BADGE_CLASS,
  CapabilityNotice,
  SectionHeading,
  useStudioCostEstimate,
} from "@/components/studio/studio-primitives";
import {
  MAX_CLIP_DURATION_SECONDS,
  formatCost,
  isStudioBusy,
  snapDurationSeconds,
} from "@/lib/studio-utils";

export interface ModelCapabilitiesSectionProps {
  variant?: "compact" | "touch";
  showHeading?: boolean;
  className?: string;
}

export function ModelCapabilitiesSection({
  variant = "compact",
  showHeading = true,
  className,
}: ModelCapabilitiesSectionProps) {
  const mode = useStudioStore((state) => state.mode);
  const selectedTextModel = useStudioStore(
    (state) => state.selectedTextModel,
  );
  const selectedVisionModel = useStudioStore(
    (state) => state.selectedVisionModel,
  );
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const selectedVideoModel = useStudioStore(
    (state) => state.selectedVideoModel,
  );
  const textModels = useStudioStore((state) => state.textModels);
  const visionModels = useStudioStore((state) => state.visionModels);
  const imageModels = useStudioStore((state) => state.imageModels);
  const videoModels = useStudioStore((state) => state.videoModels);
  const setSelectedTextModel = useStudioStore(
    (state) => state.setSelectedTextModel,
  );
  const setSelectedVisionModel = useStudioStore(
    (state) => state.setSelectedVisionModel,
  );
  const setSelectedImageModel = useStudioStore(
    (state) => state.setSelectedImageModel,
  );
  const setSelectedVideoModel = useStudioStore(
    (state) => state.setSelectedVideoModel,
  );
  const durationSeconds = useStudioStore((state) => state.durationSeconds);
  const setDurationSeconds = useStudioStore(
    (state) => state.setDurationSeconds,
  );
  const catalogStatus = useStudioStore((state) => state.catalogStatus);
  const catalogError = useStudioStore((state) => state.catalogError);
  const isRefreshingCatalog = useStudioStore(
    (state) => state.isRefreshingCatalog,
  );
  const refreshCatalog = useStudioStore((state) => state.refreshCatalog);
  const loadInitialCatalog = useStudioStore(
    (state) => state.loadInitialCatalog,
  );
  const activeStep = useStudioStore((state) => state.activeStep);

  const {
    textModel,
    visionModel,
    imageModel,
    videoModel,
    durationConfig,
    shotCount,
    costEstimate,
  } = useStudioCostEstimate();

  const busy = isStudioBusy(activeStep);
  const isTouch = variant === "touch";
  const triggerHeight = isTouch ? "h-11" : "h-9";

  const textModelItems = useMemo(
    () =>
      Object.fromEntries(
        textModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [textModels],
  );
  const visionModelItems = useMemo(
    () =>
      Object.fromEntries(
        visionModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [visionModels],
  );
  const imageModelItems = useMemo(
    () =>
      Object.fromEntries(
        imageModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [imageModels],
  );
  const videoModelItems = useMemo(
    () =>
      Object.fromEntries(
        videoModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [videoModels],
  );

  return (
    <section
      data-tour="model-capabilities"
      className={cn("space-y-3", className)}
    >
      {showHeading ? (
        <SectionHeading
          icon={<Layers className="size-3.5" />}
          title="Capability-Aware Models"
          hint="Live capability badges come from the server catalog."
        />
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={isTouch ? "mobile-text-model" : "text-model"}
            className="text-[12px] text-muted-foreground"
          >
            Text Model
          </Label>
          {textModel ? (
            <span className="text-[11px] text-muted-foreground">
              {textModel.provider}
            </span>
          ) : null}
        </div>
        <Select
          value={selectedTextModel}
          items={textModelItems}
          disabled={busy || textModels.length === 0}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSelectedTextModel(value);
            }
          }}
        >
          <SelectTrigger
            id={isTouch ? "mobile-text-model" : "text-model"}
            className={cn(
              "w-full bg-white/[0.02] text-base sm:text-xs",
              triggerHeight,
              isTouch && "data-[size=default]:h-11",
            )}
          >
            <SelectValue placeholder="Load the text model catalog" />
          </SelectTrigger>
          <SelectContent>
            {textModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {textModel ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Type className="size-2.5" />
              {formatCost(textModel.inputCostPerMillionUsd)}/M in
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Coins className="size-2.5" />
              {formatCost(textModel.outputCostPerMillionUsd)}/M out
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Sparkles className="size-2.5" />
              ~{formatCost(textModel.estimatedCostPerPlanUsd)} / plan
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={isTouch ? "mobile-vision-model" : "vision-model"}
            className="text-[12px] text-muted-foreground"
          >
            Vision QA Model
          </Label>
          {visionModel ? (
            <span className="text-[11px] text-muted-foreground">
              {visionModel.provider}
            </span>
          ) : null}
        </div>
        <Select
          value={selectedVisionModel}
          items={visionModelItems}
          disabled={busy || visionModels.length === 0}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSelectedVisionModel(value);
            }
          }}
        >
          <SelectTrigger
            id={isTouch ? "mobile-vision-model" : "vision-model"}
            className={cn(
              "w-full bg-white/[0.02] text-base sm:text-xs",
              triggerHeight,
              isTouch && "data-[size=default]:h-11",
            )}
          >
            <SelectValue placeholder="Load the vision model catalog" />
          </SelectTrigger>
          <SelectContent>
            {visionModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {visionModel ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Eye className="size-2.5" />
              Image input supported
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Coins className="size-2.5" />
              ~{formatCost(visionModel.estimatedCostPerQaUsd)} / QA call
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={isTouch ? "mobile-image-model" : "image-model"}
            className="text-[12px] text-muted-foreground"
          >
            Image Model
          </Label>
          {imageModel ? (
            <span className="text-[11px] text-muted-foreground">
              {imageModel.provider}
            </span>
          ) : null}
        </div>
        <Select
          value={selectedImageModel}
          items={imageModelItems}
          disabled={busy || imageModels.length === 0}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSelectedImageModel(value);
            }
          }}
        >
          <SelectTrigger
            id={isTouch ? "mobile-image-model" : "image-model"}
            className={cn(
              "w-full bg-white/[0.02] text-base sm:text-xs",
              triggerHeight,
              isTouch && "data-[size=default]:h-11",
            )}
          >
            <SelectValue placeholder="Load the model catalog" />
          </SelectTrigger>
          <SelectContent>
            {imageModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {imageModel ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <ImageIcon className="size-2.5" />
              Ref Images:{" "}
              {imageModel.supportsInputReferences
                ? `Max ${imageModel.maxInputReferences}`
                : "Unsupported"}
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Layers className="size-2.5" />
              {imageModel.supportedAspectRatios.join(" · ")}
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Coins className="size-2.5" />
              {formatCost(imageModel.estimatedCostPerImageUsd)} / frame
            </Badge>
          </div>
        ) : null}
        {imageModel &&
        (!imageModel.supportsInputReferences ||
          imageModel.maxInputReferences < 1) ? (
          <CapabilityNotice>
            {imageModel.label} does not accept product reference images. The
            zero-drift anchor check cannot run with this model.
          </CapabilityNotice>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={isTouch ? "mobile-video-model" : "video-model"}
            className="text-[12px] text-muted-foreground"
          >
            Video Model
          </Label>
          {videoModel ? (
            <span className="text-[11px] text-muted-foreground">
              {videoModel.provider}
            </span>
          ) : null}
        </div>
        <Select
          value={selectedVideoModel}
          items={videoModelItems}
          disabled={busy || videoModels.length === 0}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSelectedVideoModel(value);
            }
          }}
        >
          <SelectTrigger
            id={isTouch ? "mobile-video-model" : "video-model"}
            className={cn(
              "w-full bg-white/[0.02] text-base sm:text-xs",
              triggerHeight,
              isTouch && "data-[size=default]:h-11",
            )}
          >
            <SelectValue placeholder="Load the model catalog" />
          </SelectTrigger>
          <SelectContent>
            {videoModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-lg border border-white/[0.08] bg-zinc-950/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">
              Clip length
            </span>
            <span className="font-mono text-xs font-medium text-amber-200">
              {durationSeconds}s
            </span>
          </div>
          <Slider
            aria-label="Video clip length in seconds"
            min={durationConfig?.min ?? 1}
            max={durationConfig?.max ?? MAX_CLIP_DURATION_SECONDS}
            step={durationConfig?.step ?? 1}
            value={[durationSeconds]}
            disabled={
              busy ||
              !durationConfig ||
              durationConfig.min === durationConfig.max
            }
            onValueChange={(value) => {
              const next = typeof value === "number" ? value : value[0];
              if (typeof next === "number" && durationConfig) {
                setDurationSeconds(
                  snapDurationSeconds(next, durationConfig.supported),
                );
              }
            }}
            className={cn(
              "mt-2",
              isTouch &&
                "[&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-1.5",
            )}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{durationConfig ? `${durationConfig.min}s` : "—"}</span>
            <span>
              {durationConfig && durationConfig.min === durationConfig.max
                ? "Only one length"
                : durationConfig &&
                    durationConfig.max < MAX_CLIP_DURATION_SECONDS
                  ? `Model max ${durationConfig.max}s`
                  : `${MAX_CLIP_DURATION_SECONDS}s cap`}
            </span>
            <span>{durationConfig ? `${durationConfig.max}s` : "—"}</span>
          </div>
          {durationConfig && durationConfig.supported.length < 10 ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Supported:{" "}
              {durationConfig.supported
                .map((duration) => `${duration}s`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        {videoModel ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                CAPABILITY_BADGE_CLASS,
                videoModel.supportsLastFrame
                  ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80"
                  : "border-amber-400/20 bg-amber-400/[0.06] text-amber-200/80",
              )}
            >
              <Clapperboard className="size-2.5" />
              {videoModel.supportsLastFrame
                ? "Last-Frame Transitions: Supported"
                : "Single-Frame Only"}
            </Badge>
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Film className="size-2.5" />
              Ref Images:{" "}
              {videoModel.supportsInputReferences
                ? `Max ${videoModel.maxInputReferences}`
                : "None"}
            </Badge>
            {videoModel.audioMode === "optional" ||
            videoModel.audioMode === "always" ? (
              <Badge
                variant="outline"
                className={cn(
                  CAPABILITY_BADGE_CLASS,
                  "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80",
                )}
              >
                <Volume2 className="size-2.5" />
                {videoModel.audioMode === "always"
                  ? "Audio: Always On"
                  : "Audio: Included"}
              </Badge>
            ) : null}
            <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
              <Coins className="size-2.5" />
              {formatCost(
                videoModel.estimatedCostPerSecondUsd * durationSeconds,
              )}{" "}
              / {durationSeconds}s shot
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-zinc-950/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/90">
            <Timer className="size-3.5 text-amber-300" />
            Estimated full run
          </span>
          <span className="font-mono text-xs font-medium text-amber-200">
            ~{formatCost(costEstimate.totalUsd)}
          </span>
        </div>
        <dl className="mt-2.5 space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Text plan</dt>
            <dd className="font-mono text-foreground/80">
              {formatCost(costEstimate.planUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Vision QA × {shotCount}</dt>
            <dd className="font-mono text-foreground/80">
              {formatCost(costEstimate.visionQaUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Keyframes × {shotCount}
            </dt>
            <dd className="font-mono text-foreground/80">
              {formatCost(costEstimate.imageUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Video × {shotCount} ({durationSeconds}s)
            </dt>
            <dd className="font-mono text-foreground/80">
              {formatCost(costEstimate.videoUsd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-1">
            <dt className="font-medium text-foreground/90">Total</dt>
            <dd className="font-mono font-medium text-amber-200">
              ~{formatCost(costEstimate.totalUsd)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {shotCount} keyframe{shotCount === 1 ? "" : "s"} + {shotCount} ×{" "}
          {durationSeconds}s video{shotCount === 1 ? "" : "s"} + {shotCount} QA
          call{shotCount === 1 ? "" : "s"}. Worst case with one retry per shot:{" "}
          <span className="font-mono text-foreground/80">
            ~{formatCost(costEstimate.worstCaseTotalUsd)}
          </span>
          .{mode === "mock"
            ? " Mock runs spend $0.00; this is the live combination estimate."
            : mode === "hybrid"
              ? " Hybrid mocks video, so this run excludes its cost."
              : null}
        </p>
      </div>

      {catalogStatus === "loading" ? (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-amber-300" />
          Syncing the capability catalog…
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
        <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
          Snapshot is instant. Refresh pulls live OpenRouter ratios,
          durations, frame support, and pricing.
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={busy || isRefreshingCatalog}
          onClick={() => void refreshCatalog()}
          className={cn("shrink-0", isTouch && "min-h-11 px-3")}
        >
          {isRefreshingCatalog ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Refresh live
        </Button>
      </div>

      {catalogStatus === "error" ? (
        <div className="space-y-2 rounded-lg border border-rose-400/25 bg-rose-500/10 p-2.5 text-[12px] text-rose-100/85">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>{catalogError ?? "The capability catalog is unavailable."}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void loadInitialCatalog()}
            className="border-rose-300/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
          >
            <RefreshCw className="size-3" />
            Retry catalog
          </Button>
        </div>
      ) : null}
    </section>
  );
}
