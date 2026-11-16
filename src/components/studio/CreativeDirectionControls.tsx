"use client";

import { Loader2, Sparkles, WandSparkles } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";
import {
  describeShotSequence,
  SHOT_COUNT_OPTIONS,
} from "@/domain/entities/shot-sequence";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudioStore } from "@/store/use-studio-store";
import {
  CapabilityNotice,
  SectionHeading,
  useStudioCostEstimate,
} from "@/components/studio/studio-primitives";
import {
  ASPECT_RATIO_OPTIONS,
  TONE_LABELS,
  TONE_OPTIONS,
  isBrandTone,
  isStudioBusy,
} from "@/lib/studio-utils";

export interface CreativeDirectionControlsProps {
  variant?: "compact" | "touch";
  showHeading?: boolean;
  className?: string;
}

export function CreativeDirectionControls({
  variant = "compact",
  showHeading = true,
  className,
}: CreativeDirectionControlsProps) {
  const tone = useStudioStore((state) => state.tone);
  const setTone = useStudioStore((state) => state.setTone);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const setAspectRatio = useStudioStore((state) => state.setAspectRatio);
  const shotCount = useStudioStore((state) => state.shotCount);
  const setShotCount = useStudioStore((state) => state.setShotCount);
  const campaign = useStudioStore((state) => state.campaign);
  const userGoal = useStudioStore((state) => state.userGoal);
  const setUserGoal = useStudioStore((state) => state.setUserGoal);
  const product = useStudioStore((state) => state.product);
  const isGeneratingBrief = useStudioStore(
    (state) => state.isGeneratingBrief,
  );
  const generateCreativeBrief = useStudioStore(
    (state) => state.generateCreativeBrief,
  );
  const activeStep = useStudioStore((state) => state.activeStep);
  const { imageModel, videoModel } = useStudioCostEstimate();

  const busy = isStudioBusy(activeStep);
  const isTouch = variant === "touch";
  const canDraftBrief =
    product.name.trim() !== "" &&
    product.category.trim() !== "" &&
    !busy &&
    !isGeneratingBrief;
  const toneHint =
    TONE_OPTIONS.find((option) => option.value === tone)?.hint ?? "";

  const imageAspectSupported =
    !imageModel || imageModel.supportedAspectRatios.includes(aspectRatio);
  const videoAspectSupported =
    !videoModel || videoModel.supportedAspectRatios.includes(aspectRatio);
  const aspectSupported = imageAspectSupported && videoAspectSupported;
  const unsupportedRatios = ASPECT_RATIO_OPTIONS.filter(
    (option) =>
      (imageModel &&
        !imageModel.supportedAspectRatios.includes(option.value)) ||
      (videoModel && !videoModel.supportedAspectRatios.includes(option.value)),
  );

  const controlHeight = isTouch ? "h-11" : "h-9";

  return (
    <section className={cn("space-y-3", className)}>
      {showHeading ? (
        <SectionHeading
          icon={<Sparkles className="size-3.5" />}
          title="Creative Direction"
          hint="Shapes the director brief and the social ad framing."
        />
      ) : null}

      <div className="space-y-1.5">
        <Label
          htmlFor={isTouch ? "mobile-brand-tone" : "brand-tone"}
          className="text-[12px] text-muted-foreground"
        >
          Brand Tone
        </Label>
        <Select
          value={tone}
          items={TONE_LABELS}
          disabled={busy}
          onValueChange={(value) => {
            if (typeof value === "string" && isBrandTone(value)) {
              setTone(value);
            }
          }}
        >
          <SelectTrigger
            id={isTouch ? "mobile-brand-tone" : "brand-tone"}
            className={cn(
              "w-full bg-white/[0.02] text-base sm:text-xs",
              controlHeight,
              isTouch && "data-[size=default]:h-11",
            )}
          >
            <SelectValue placeholder="Select brand tone" />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {toneHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label
          id={isTouch ? "mobile-aspect-ratio-label" : "aspect-ratio-label"}
          className="text-[12px] text-muted-foreground"
        >
          Aspect Ratio
        </Label>
        <div
          role="group"
          aria-labelledby={
            isTouch ? "mobile-aspect-ratio-label" : "aspect-ratio-label"
          }
          className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-zinc-950/50 p-1"
        >
          {ASPECT_RATIO_OPTIONS.map((option) => {
            const supported =
              (!imageModel ||
                imageModel.supportedAspectRatios.includes(option.value)) &&
              (!videoModel ||
                videoModel.supportedAspectRatios.includes(option.value));
            const selected = aspectRatio === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={busy || !supported}
                aria-pressed={selected}
                aria-label={`${option.label} ${option.orientation}${
                  supported
                    ? ""
                    : " — not supported by the selected image or video model"
                }`}
                onClick={() => setAspectRatio(option.value)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  isTouch ? "h-12" : "h-10",
                  selected
                    ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                    : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <span className="font-mono">{option.label}</span>
                <span className="text-[11px] font-normal opacity-80">
                  {option.orientation}
                </span>
              </button>
            );
          })}
        </div>
        {unsupportedRatios.length > 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Unavailable with the selected models:{" "}
            {unsupportedRatios.map((option) => option.label).join(", ")}.
          </p>
        ) : null}
        {!aspectSupported ? (
          <CapabilityNotice tone="rose">
            The selected models do not both support {aspectRatio}. Pick a
            compatible ratio or switch a model before running.
          </CapabilityNotice>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            id={
              isTouch
                ? "mobile-storyboard-length-label"
                : "storyboard-length-label"
            }
            className="text-[12px] text-muted-foreground"
          >
            Storyboard Length
          </Label>
          <span className="font-mono text-[11px] text-muted-foreground">
            {shotCount} keyframe{shotCount === 1 ? "" : "s"} + {shotCount} clip
            {shotCount === 1 ? "" : "s"}
          </span>
        </div>
        <div
          role="group"
          aria-labelledby={
            isTouch
              ? "mobile-storyboard-length-label"
              : "storyboard-length-label"
          }
          className="grid grid-cols-5 gap-1 rounded-lg border border-white/10 bg-zinc-950/50 p-1"
        >
          {SHOT_COUNT_OPTIONS.map((option) => {
            const selected = shotCount === option;

            return (
              <button
                key={option}
                type="button"
                disabled={busy}
                aria-pressed={selected}
                aria-label={`${option} shot${option === 1 ? "" : "s"}`}
                onClick={() => setShotCount(option)}
                className={cn(
                  "rounded-md border font-mono text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  isTouch ? "h-11" : "h-9",
                  selected
                    ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                    : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {describeShotSequence(shotCount)}. Each shot ships one keyframe and
          one clip.
        </p>
        {campaign !== null && campaign.shots.length !== shotCount ? (
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            The active campaign has {campaign.shots.length} shots. This applies
            to the next plan.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={isTouch ? "mobile-creative-brief" : "creative-brief"}
            className="text-[12px] text-muted-foreground"
          >
            Creative Brief{" "}
            <span className="font-normal opacity-60">(optional)</span>
          </Label>
          <span className="font-mono text-[11px] text-muted-foreground">
            {userGoal.length}/500
          </span>
        </div>
        <div className="relative">
          <Textarea
            id={isTouch ? "mobile-creative-brief" : "creative-brief"}
            value={userGoal}
            disabled={busy}
            maxLength={500}
            rows={3}
            placeholder="Launch window, must-hit product beats, offer, audience..."
            onChange={(event) => setUserGoal(event.target.value)}
            className={cn(
              "resize-none bg-white/[0.02] text-base sm:text-xs",
              isTouch ? "min-h-20 pr-12" : "min-h-16 pr-11",
            )}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!canDraftBrief}
                  onClick={() => {
                    void generateCreativeBrief();
                  }}
                  aria-label="Draft the creative brief with AI"
                  className={cn(
                    "absolute right-2 bottom-2 inline-flex items-center justify-center rounded-md border border-white/10 bg-zinc-950/85 text-muted-foreground transition-colors hover:border-amber-300/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40",
                    isTouch ? "size-9" : "size-7",
                  )}
                >
                  {isGeneratingBrief ? (
                    <Loader2 className="size-3.5 animate-spin text-amber-300" />
                  ) : (
                    <WandSparkles className="size-3.5" />
                  )}
                </button>
              }
            />
            <TooltipContent side="left">
              {isGeneratingBrief
                ? "Drafting the brief…"
                : "Draft with AI · replaces the current brief"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
