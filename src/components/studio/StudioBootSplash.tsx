"use client";

import { Aperture, Loader2 } from "lucide-react";

export function StudioBootSplash() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 text-zinc-950 shadow-[0_0_48px_rgba(251,191,36,0.28)] ring-1 ring-white/30">
          <Aperture className="size-6" strokeWidth={2.2} />
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            DriftZero Studio
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Preparing the responsive studio…
          </p>
        </div>
        <Loader2 className="size-4 animate-spin text-amber-300" />
      </div>
    </div>
  );
}
