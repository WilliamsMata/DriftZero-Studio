"use client";

import {
  Gauge,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useStudioStore } from "@/store/use-studio-store";
import {
  SectionHeading,
  useStudioBudgetSummary,
} from "@/components/studio/studio-primitives";
import {
  COST_STEP_LABELS,
  MAX_BUDGET_USD,
  MIN_BUDGET_USD,
  MODE_LABELS,
  TOTAL_MEDIA_BUDGET_USD,
  formatCost,
  formatUsd,
  isStudioBusy,
} from "@/lib/studio-utils";

export interface BudgetGuardrailCardProps {
  className?: string;
}

export function BudgetGuardrailCard({
  className,
}: BudgetGuardrailCardProps) {
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const setMaxBudgetUsd = useStudioStore((state) => state.setMaxBudgetUsd);
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);

  const busy = isStudioBusy(activeStep);

  return (
    <section className={cn("space-y-3", className)}>
      <SectionHeading
        icon={<Gauge className="size-3.5" />}
        title="Budget Guardrail"
        hint="Every media call is pre-reserved against this cap."
      />

      <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted-foreground">
            Campaign cap
          </span>
          <span className="font-mono text-xs font-medium text-amber-200">
            {formatUsd(maxBudgetUsd, 2)}
          </span>
        </div>
        <Slider
          aria-label="Maximum campaign budget in US dollars"
          min={MIN_BUDGET_USD}
          max={MAX_BUDGET_USD}
          step={0.25}
          value={[maxBudgetUsd]}
          disabled={busy}
          onValueChange={(value) => {
            const next = typeof value === "number" ? value : value[0];
            if (typeof next === "number") {
              setMaxBudgetUsd(next);
            }
          }}
          className="mt-3 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-track]]:h-1.5"
        />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatUsd(MIN_BUDGET_USD, 2)}</span>
          <span>Hard stop per campaign</span>
          <span>{formatUsd(MAX_BUDGET_USD, 2)}</span>
        </div>
      </div>

      {campaign && campaign.ledger.maxBudgetUsd !== maxBudgetUsd ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The active campaign stays locked at{" "}
          <span className="font-mono text-foreground/80">
            {formatUsd(campaign.ledger.maxBudgetUsd, 2)}
          </span>
          . The new cap applies to the next plan.
        </p>
      ) : null}
    </section>
  );
}

export interface FinOpsLedgerCardProps {
  variant?: "desktop" | "mobile";
  showBudgetCap?: boolean;
  className?: string;
}

export function FinOpsLedgerCard({
  variant = "desktop",
  showBudgetCap = false,
  className,
}: FinOpsLedgerCardProps) {
  const mode = useStudioStore((state) => state.mode);
  const {
    campaign,
    totalUsd,
    budgetCap,
    remainingUsd,
    budgetPercent,
    budgetBarClassName,
  } = useStudioBudgetSummary();

  const isMobile = variant === "mobile";
  const ledger = campaign?.ledger;
  const ledgerEntries = ledger?.entries ?? [];
  const runMode = campaign?.mode ?? mode;

  return (
    <Card
      data-tour="finops-ledger"
      className={cn(
        "gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm",
        className,
      )}
    >
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
          >
            <Wallet className="size-2.5" />
            {MODE_LABELS[runMode]} run
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        {showBudgetCap ? (
          <BudgetGuardrailCard className="border-b border-white/[0.06] pb-3" />
        ) : null}

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

        {isMobile ? (
          <div className="max-h-[42dvh] space-y-2 overflow-y-auto overscroll-contain pr-0.5 studio-scrollbar">
            {ledgerEntries.length === 0 ? (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-6 text-center text-[12px] leading-relaxed text-muted-foreground">
                No spend recorded yet. Run the pipeline or load a showcase
                preset.
              </p>
            ) : (
              ledgerEntries.map((entry, index) => (
                <div
                  key={`${entry.step}-${entry.model}-${index}`}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium">
                        {COST_STEP_LABELS[entry.step]}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {entry.model}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[12px] text-amber-100/85">
                      {formatCost(entry.costUsd)}
                    </span>
                  </div>
                  {entry.note ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
                      {entry.note}
                    </p>
                  ) : null}
                </div>
              ))
            )}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[12px]">
              <span className="font-medium">Total</span>
              <span className="font-mono font-medium text-amber-100">
                {formatCost(totalUsd)}
              </span>
            </div>
          </div>
        ) : (
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
        )}

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
  );
}
