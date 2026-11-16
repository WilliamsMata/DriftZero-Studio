"use client";

import { ClipboardList } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BudgetGuardrailCard } from "@/components/studio/FinOpsLedgerCard";
import { CreativeDirectionControls } from "@/components/studio/CreativeDirectionControls";
import { ExecutionControls } from "@/components/studio/ExecutionControls";
import { ModelCapabilitiesSection } from "@/components/studio/ModelCapabilitiesSection";
import { ProductAnchorPicker } from "@/components/studio/ProductAnchorPicker";

export function CampaignConfigPanel({
  variant = "compact",
  showBudgetGuardrail = true,
}: {
  variant?: "compact" | "touch";
  showBudgetGuardrail?: boolean;
}) {
  return (
    <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
      <CardHeader className="border-b border-white/5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="flex size-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                <ClipboardList className="size-3.5" />
              </span>
              Campaign Config
            </CardTitle>
            <CardDescription className="mt-1 text-[12px]">
              Anchor, direction, models, guardrails.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 py-4">
        <ProductAnchorPicker variant={variant} />
        <Separator className="bg-white/5" />
        <CreativeDirectionControls variant={variant} />
        <Separator className="bg-white/5" />
        <ModelCapabilitiesSection variant={variant} />
        {showBudgetGuardrail ? (
          <>
            <Separator className="bg-white/5" />
            <BudgetGuardrailCard />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ExecutionPanel({ touch = false }: { touch?: boolean }) {
  return <ExecutionControls touch={touch} />;
}
