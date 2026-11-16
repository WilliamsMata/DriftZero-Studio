"use client";

import { Fragment } from "react";
import {
  Aperture,
  Loader2,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudioStore } from "@/store/use-studio-store";
import { StudioTourTrigger } from "@/components/tour/StudioTourTrigger";
import {
  TOTAL_MEDIA_BUDGET_USD,
  formatUsd,
  isStudioBusy,
} from "@/lib/studio-utils";
import type { ExecutionMode } from "@/domain/entities/campaign";

const MODE_OPTIONS: ReadonlyArray<{
  value: ExecutionMode;
  label: string;
  dotClassName: string;
  activeClassName: string;
}> = [
  {
    value: "mock",
    label: "Mock $0.00",
    dotClassName: "bg-emerald-300",
    activeClassName:
      "border-emerald-400/30 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.12)]",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    dotClassName: "bg-amber-300",
    activeClassName:
      "border-amber-400/30 bg-amber-400/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
  },
  {
    value: "live",
    label: "Live OpenRouter",
    dotClassName: "bg-rose-300",
    activeClassName:
      "border-rose-400/30 bg-rose-400/15 text-rose-100 shadow-[0_0_20px_rgba(251,113,133,0.12)]",
  },
];

export function StudioHeader() {
  const mode = useStudioStore((state) => state.mode);
  const setMode = useStudioStore((state) => state.setMode);
  const presets = useStudioStore((state) => state.presets);
  const loadPreset = useStudioStore((state) => state.loadPreset);
  const campaign = useStudioStore((state) => state.campaign);
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const activeStep = useStudioStore((state) => state.activeStep);
  const catalogStatus = useStudioStore((state) => state.catalogStatus);
  const catalogError = useStudioStore((state) => state.catalogError);
  const loadInitialCatalog = useStudioStore(
    (state) => state.loadInitialCatalog,
  );

  const busy = isStudioBusy(activeStep);
  const totalUsd = campaign?.ledger.totalUsd ?? 0;
  const budgetCap = campaign?.ledger.maxBudgetUsd ?? maxBudgetUsd;
  const budgetPercent =
    budgetCap <= 0 ? 0 : Math.min((totalUsd / budgetCap) * 100, 100);

  const budgetBarClassName =
    budgetPercent >= 90
      ? "bg-rose-400"
      : budgetPercent >= 70
        ? "bg-amber-400"
        : "bg-emerald-400";

  function renderModeButton(option: (typeof MODE_OPTIONS)[number]) {
    const active = mode === option.value;

    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={busy}
        onClick={() => setMode(option.value)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          active
            ? option.activeClassName
            : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            option.dotClassName,
            option.value === "live" && mode === "live" && "animate-pulse",
          )}
        />
        {option.label}
      </button>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1880px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 text-zinc-950 shadow-[0_0_32px_rgba(251,191,36,0.22)] ring-1 ring-white/30">
            <Aperture className="size-5" strokeWidth={2.2} />
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base leading-tight font-semibold tracking-tight">
                DriftZero Studio
              </h1>
              <Badge
                variant="outline"
                className="hidden h-6 border-white/10 bg-white/[0.03] px-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase sm:inline-flex"
              >
                Studio
              </Badge>
            </div>
            <Badge
              variant="outline"
              className="mt-1 h-6 gap-1.5 border-amber-300/15 bg-amber-300/[0.06] px-2 text-[11px] font-medium tracking-[0.16em] text-amber-100/90 uppercase"
            >
              <span className="size-1 rounded-full bg-amber-300/80" />
              Zero-Drift E-Commerce Ad Pipeline
            </Badge>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/10 lg:block" />

        <div
          data-tour="showcase-presets"
          className="flex min-w-0 flex-wrap items-center gap-1.5"
        >
          <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Showcase
          </span>

          {catalogStatus === "loading" ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[12px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading presets
            </span>
          ) : null}

          {presets.map((preset) => {
            const active = campaign?.id === preset.campaign.id;

            return (
              <Tooltip key={preset.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={active}
                      onClick={() => loadPreset(preset.id)}
                      className={cn(
                        "inline-flex h-8 max-w-[190px] items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        active
                          ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Sparkles
                        className={cn(
                          "size-3",
                          active ? "text-amber-300" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{preset.name}</span>
                    </button>
                  }
                />
                <TooltipContent
                  side="bottom"
                  className="max-w-[280px] leading-relaxed"
                >
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-background/75">
                    {" "}
                    — {preset.description}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {catalogStatus === "error" ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Retry loading the studio catalog"
                    onClick={() => void loadInitialCatalog()}
                  />
                }
              >
                <TriangleAlert className="size-3.5 text-amber-300" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px]">
                Catalog unavailable. {catalogError ?? "Retry the sync."}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <StudioTourTrigger />

          <div
            role="group"
            aria-label="Execution mode for the next run"
            className="flex items-center rounded-xl border border-white/10 bg-zinc-950/70 p-1"
          >
            <span className="hidden px-1.5 text-[11px] text-muted-foreground sm:inline">
              Next run
            </span>
            {MODE_OPTIONS.map((option) => {
              if (option.value !== "live") {
                return (
                  <Fragment key={option.value}>
                    {renderModeButton(option)}
                  </Fragment>
                );
              }

              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger render={renderModeButton(option)} />
                  <TooltipContent
                    side="bottom"
                    className="max-w-[280px] leading-relaxed"
                  >
                    Live mode sends real OpenRouter requests. Every media call
                    is checked against the campaign budget guardrail before it
                    runs.
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div
            className="flex min-w-[186px] flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5"
            title={`${formatUsd(totalUsd)} spent of ${formatUsd(
              budgetCap,
            )} this campaign · ${formatUsd(
              Math.max(budgetCap - totalUsd, 0),
            )} remaining · project media budget ${formatUsd(
              TOTAL_MEDIA_BUDGET_USD,
            )}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <Wallet className="size-3 text-emerald-300" />
                FinOps
              </span>
              <span className="font-mono text-[12px] leading-none text-foreground">
                {formatUsd(totalUsd)}
                <span className="text-muted-foreground">
                  {" "}
                  / {formatUsd(budgetCap)} USD
                </span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  budgetBarClassName,
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
