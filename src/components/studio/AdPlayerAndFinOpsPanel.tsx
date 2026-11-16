"use client";

import { CommercialPlayerStage } from "@/components/studio/CommercialPlayerStage";
import { FinOpsLedgerCard } from "@/components/studio/FinOpsLedgerCard";

export function AdPlayerAndFinOpsPanel() {
  return (
    <div className="space-y-4">
      <CommercialPlayerStage variant="desktop" />
      <FinOpsLedgerCard variant="desktop" />
    </div>
  );
}
