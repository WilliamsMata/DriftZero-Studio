"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopStudioShell } from "@/components/studio/DesktopStudioShell";
import { MobileStudioShell } from "@/components/studio/MobileStudioShell";
import { StudioBootSplash } from "@/components/studio/StudioBootSplash";
import { TabletStudioShell } from "@/components/studio/TabletStudioShell";
import { StudioTourController } from "@/components/tour/StudioTourController";
import {
  useHasMounted,
  useViewportTier,
} from "@/hooks/use-viewport-tier";
import { useStudioStore } from "@/store/use-studio-store";

export default function Home() {
  const tier = useViewportTier();
  const hasMounted = useHasMounted();
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
      <a
        href="#studio-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-amber-300 focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-zinc-950"
      >
        Skip to studio content
      </a>

      {/* Only one shell, and therefore only one live <video>, is mounted. */}
      {hasMounted ? (
        tier === "mobile" ? (
          <MobileStudioShell />
        ) : tier === "tablet" ? (
          <TabletStudioShell />
        ) : (
          <DesktopStudioShell />
        )
      ) : (
        <StudioBootSplash />
      )}

      <StudioTourController />
    </TooltipProvider>
  );
}
