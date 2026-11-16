"use client";

import { ShieldCheck } from "lucide-react";
import { StudioHeader } from "@/components/studio/StudioHeader";
import {
  CampaignConfigPanel,
  ExecutionPanel,
} from "@/components/studio/CampaignConfigPanel";
import { StoryboardWorkspace } from "@/components/studio/StoryboardWorkspace";
import { AdPlayerAndFinOpsPanel } from "@/components/studio/AdPlayerAndFinOpsPanel";

export function DesktopStudioShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <StudioHeader />

      <main
        id="studio-main"
        tabIndex={-1}
        className="flex-1 px-3 pt-4 pb-6 sm:px-4 lg:px-5"
      >
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
    </div>
  );
}
