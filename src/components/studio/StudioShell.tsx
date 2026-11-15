"use client";

import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  CampaignConfigPanel,
  ExecutionPanel,
} from "@/components/studio/CampaignConfigPanel";
import { StoryboardWorkspace } from "@/components/studio/StoryboardWorkspace";
import { AdPlayerAndFinOpsPanel } from "@/components/studio/AdPlayerAndFinOpsPanel";
import { useStudioStore } from "@/store/use-studio-store";

export function StudioShell() {
  const loadInitialCatalog = useStudioStore(
    (state) => state.loadInitialCatalog,
  );
  const stopVideoPolling = useStudioStore(
    (state) => state.stopVideoPolling,
  );

  useEffect(() => {
    void loadInitialCatalog();

    return () => {
      stopVideoPolling();
    };
  }, [loadInitialCatalog, stopVideoPolling]);

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#storyboard"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-amber-300 focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-zinc-950"
        >
          Skip to storyboard
        </a>

        <StudioHeader />

        <main className="flex-1 px-3 pt-4 pb-6 sm:px-4 lg:px-5">
          <div className="mx-auto grid w-full max-w-[1880px] grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,336px)_minmax(0,1fr)_minmax(340px,392px)] xl:items-start">
            <div className="order-3 min-w-0 xl:order-1 xl:sticky xl:top-[84px] xl:flex xl:max-h-[calc(100dvh-100px)] xl:flex-col xl:gap-3">
              <div className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-0.5 studio-scrollbar">
                <CampaignConfigPanel />
                <div
                  aria-hidden="true"
                  className="pointer-events-none sticky bottom-0 -mt-10 hidden h-10 bg-gradient-to-t from-background to-transparent xl:block"
                />
              </div>

              <ExecutionPanel />
            </div>

            <div className="order-2 min-w-0 xl:order-2">
              <StoryboardWorkspace />
            </div>

            <div className="order-1 min-w-0 xl:order-3 xl:sticky xl:top-[84px] xl:max-h-[calc(100dvh-100px)] xl:overflow-y-auto xl:pr-0.5 studio-scrollbar">
              <AdPlayerAndFinOpsPanel />
            </div>
          </div>
        </main>

        <footer className="border-t border-white/[0.06] px-4 py-3">
          <div className="mx-auto flex w-full max-w-[1880px] flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-emerald-400/80" />
              Server-proxied media · budget-guarded stages · no client-side API
              keys
            </span>
            <span className="font-mono tracking-[0.12em] uppercase">
              DriftZero Studio · Phase 2
            </span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
