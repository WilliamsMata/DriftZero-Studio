"use client";

import { useEffect, useRef } from "react";
import { useHasMounted } from "@/hooks/use-viewport-tier";
import { useStudioStore } from "@/store/use-studio-store";
import { useStudioTour } from "@/components/tour/use-studio-tour";

/**
 * Mounts once next to the active responsive shell. It keeps the driver.js
 * lifecycle out of the shells while still reading their live Zustand state.
 */
export function StudioTourController() {
  const { startTour } = useStudioTour();
  const hasMounted = useHasMounted();
  const tourRequestId = useStudioStore((state) => state.tourRequestId);
  const handledRequestRef = useRef(0);
  const autoLaunchConsumedRef = useRef(false);

  useEffect(() => {
    if (tourRequestId === 0 || tourRequestId === handledRequestRef.current) {
      return;
    }

    handledRequestRef.current = tourRequestId;
    void startTour();
  }, [startTour, tourRequestId]);

  useEffect(() => {
    if (!hasMounted || autoLaunchConsumedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const tourParam = params.get("tour");

    if (tourParam !== "1" && tourParam !== "true") return;

    autoLaunchConsumedRef.current = true;

    // Explicit demo links always launch, even when the tour was seen before.
    void startTour();
  }, [hasMounted, startTour]);

  return null;
}
