"use client";

import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { useStudioStore } from "@/store/use-studio-store";
import {
  estimateCampaignCostUsd,
  getDurationSliderConfig,
} from "@/lib/studio-utils";

export const CAPABILITY_BADGE_CLASS =
  "h-auto min-h-5 gap-1 rounded-md border-white/[0.08] bg-white/[0.03] px-1.5 py-1 text-[11px] font-normal text-muted-foreground";

export const MODE_BADGE_CLASS = {
  mock: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  hybrid: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  live: "border-rose-400/25 bg-rose-400/10 text-rose-200",
} as const;

export function SectionHeading({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-foreground/90 uppercase">
          {title}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CapabilityNotice({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "rose";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-[12px] leading-relaxed",
        tone === "rose"
          ? "border-rose-400/25 bg-rose-500/10 text-rose-100/85"
          : "border-amber-400/20 bg-amber-400/[0.07] text-amber-100/80",
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function useStudioCostEstimate() {
  const textModels = useStudioStore((state) => state.textModels);
  const visionModels = useStudioStore((state) => state.visionModels);
  const imageModels = useStudioStore((state) => state.imageModels);
  const videoModels = useStudioStore((state) => state.videoModels);
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
  const shotCount = useStudioStore((state) => state.shotCount);
  const durationSeconds = useStudioStore((state) => state.durationSeconds);

  const textModel = textModels.find(
    (model) => model.id === selectedTextModel,
  );
  const visionModel = visionModels.find(
    (model) => model.id === selectedVisionModel,
  );
  const imageModel = imageModels.find(
    (model) => model.id === selectedImageModel,
  );
  const videoModel = videoModels.find(
    (model) => model.id === selectedVideoModel,
  );
  const durationConfig = getDurationSliderConfig(videoModel);

  const costEstimate = estimateCampaignCostUsd({
    planCostUsd: textModel?.estimatedCostPerPlanUsd ?? 0,
    visionQaCostPerCallUsd: visionModel?.estimatedCostPerQaUsd ?? 0,
    imageCostPerImageUsd: imageModel?.estimatedCostPerImageUsd ?? 0,
    videoCostPerSecondUsd: videoModel?.estimatedCostPerSecondUsd ?? 0,
    durationSeconds,
    shotCount,
  });

  return {
    textModel,
    visionModel,
    imageModel,
    videoModel,
    durationConfig,
    durationSeconds,
    shotCount,
    costEstimate,
  };
}

export function useStudioBudgetSummary() {
  const campaign = useStudioStore((state) => state.campaign);
  const configMaxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);

  const totalUsd = campaign?.ledger.totalUsd ?? 0;
  const budgetCap = campaign?.ledger.maxBudgetUsd ?? configMaxBudgetUsd;
  const remainingUsd = Math.max(budgetCap - totalUsd, 0);
  const budgetPercent =
    budgetCap <= 0 ? 0 : Math.min((totalUsd / budgetCap) * 100, 100);
  const budgetBarClassName =
    budgetPercent >= 90
      ? "bg-rose-400"
      : budgetPercent >= 70
        ? "bg-amber-400"
        : "bg-emerald-400";

  return {
    campaign,
    totalUsd,
    budgetCap,
    remainingUsd,
    budgetPercent,
    budgetBarClassName,
  };
}
