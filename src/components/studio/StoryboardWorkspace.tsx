"use client";

import {
  Clapperboard,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useStudioStore } from "@/store/use-studio-store";
import { DirectorBriefCard } from "@/components/studio/DirectorBriefCard";
import {
  buildFallbackShots,
  ShotStoryboardCard,
} from "@/components/studio/ShotStoryboardCard";
import { STEP_META, isStudioBusy } from "@/lib/studio-utils";

export function StoryboardWorkspace() {
  const campaign = useStudioStore((state) => state.campaign);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const product = useStudioStore((state) => state.product);
  const activeStep = useStudioStore((state) => state.activeStep);
  const presets = useStudioStore((state) => state.presets);
  const shotCount = useStudioStore((state) => state.shotCount);
  const imageModels = useStudioStore((state) => state.imageModels);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const loadPreset = useStudioStore((state) => state.loadPreset);

  const busy = isStudioBusy(activeStep);
  const planning = activeStep === "planning";
  const keyframesGenerating = activeStep === "keyframes";
  const firstPreset = presets[0];
  const estimatedFrameCostUsd =
    imageModels.find((model) => model.id === selectedImageModel)
      ?.estimatedCostPerImageUsd ?? 0;

  const displayAspectRatio = campaign?.aspectRatio ?? aspectRatio;
  const displayProductImage = campaign?.product.imageUrl ?? product.imageUrl;
  const displayShots = campaign?.shots ?? buildFallbackShots(shotCount);
  const displayShotCount = displayShots.length;

  const keyframeCount =
    campaign?.results.filter((result) => result.keyframeUrl.trim() !== "")
      .length ?? 0;
  const readyClipCount =
    campaign?.results.filter((result) => result.videoStatus === "completed")
      .length ?? 0;

  return (
    <div id="storyboard" tabIndex={-1} className="space-y-4 outline-none">
      <DirectorBriefCard />

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
        {displayShots.map((fallbackShot) => {
          const shot =
            campaign?.shots.find(
              (candidate) => candidate.index === fallbackShot.index,
            ) ?? fallbackShot;
          const result = campaign?.results.find(
            (candidate) => candidate.shotIndex === shot.index,
          );

          return (
            <ShotStoryboardCard
              key={shot.index}
              shot={shot}
              result={result}
              productImageUrl={displayProductImage}
              generating={keyframesGenerating && !result?.keyframeUrl}
              aspectRatio={displayAspectRatio}
              estimatedFrameCostUsd={estimatedFrameCostUsd}
              variant="desktop"
            />
          );
        })}
      </div>
    </div>
  );
}
