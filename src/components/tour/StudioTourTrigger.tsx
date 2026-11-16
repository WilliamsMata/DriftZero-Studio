"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  STUDIO_TOUR_SEEN_EVENT,
  hasSeenStudioTour,
} from "@/lib/tour/studio-tour-storage";
import { useStudioStore } from "@/store/use-studio-store";

export interface StudioTourTriggerProps {
  variant?: "desktop" | "tablet" | "mobile";
  className?: string;
}

export function StudioTourTrigger({
  variant = "desktop",
  className,
}: StudioTourTriggerProps) {
  const requestTour = useStudioStore((state) => state.requestTour);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const refresh = () => setSeen(hasSeenStudioTour());
    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(STUDIO_TOUR_SEEN_EVENT, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STUDIO_TOUR_SEEN_EVENT, refresh);
    };
  }, []);

  const label = seen ? "Replay tour" : "Tour";
  const ariaLabel = seen
    ? "Replay the guided studio tour"
    : "Start the guided studio tour";
  const Icon = seen ? HelpCircle : Sparkles;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={requestTour}
        aria-label={ariaLabel}
        title={label}
        className={cn(
          "inline-flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:border-amber-300/35 hover:text-amber-200",
          className,
        )}
      >
        <Icon className="size-3.5" />
      </button>
    );
  }

  if (variant === "tablet") {
    return (
      <button
        type="button"
        onClick={requestTour}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-amber-300/35 hover:text-amber-200",
          className,
        )}
      >
        <Icon className="size-3.5 text-amber-300" />
        {label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={requestTour}
      aria-label={ariaLabel}
      className={cn(
        "h-8 gap-1.5 border-amber-300/15 bg-amber-300/[0.04] text-[12px] text-amber-100/90 hover:border-amber-300/35 hover:bg-amber-300/10 hover:text-amber-50",
        className,
      )}
    >
      <Icon className="size-3.5 text-amber-300" />
      {label}
    </Button>
  );
}
