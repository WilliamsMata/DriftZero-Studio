"use client";

import { useSyncExternalStore } from "react";

export type ViewportTier = "mobile" | "tablet" | "desktop";

export const MOBILE_MAX_WIDTH = 767;
export const TABLET_MAX_WIDTH = 1279;

const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;
const TABLET_QUERY = `(min-width: ${MOBILE_MAX_WIDTH + 1}px) and (max-width: ${TABLET_MAX_WIDTH}px)`;
const DESKTOP_QUERY = `(min-width: ${TABLET_MAX_WIDTH + 1}px)`;

function resolveViewportTier(): ViewportTier {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;

  if (width <= MOBILE_MAX_WIDTH) return "mobile";
  if (width <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

function subscribeToViewport(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const mediaQueries = [
    window.matchMedia(MOBILE_QUERY),
    window.matchMedia(TABLET_QUERY),
    window.matchMedia(DESKTOP_QUERY),
  ];

  for (const query of mediaQueries) {
    query.addEventListener("change", onChange);
  }
  window.addEventListener("resize", onChange);

  return () => {
    for (const query of mediaQueries) {
      query.removeEventListener("change", onChange);
    }
    window.removeEventListener("resize", onChange);
  };
}

/**
 * Resolves the active responsive tier without a hydration mismatch.
 * The server snapshot is always "desktop"; consumers that must avoid painting
 * the wrong shell should gate their first render with useHasMounted().
 */
export function useViewportTier(): ViewportTier {
  return useSyncExternalStore(
    subscribeToViewport,
    resolveViewportTier,
    () => "desktop" as const,
  );
}

/** True only after React has hydrated and browser APIs are safe to use. */
const subscribeToNothing = () => () => undefined;
const getClientMounted = () => true as const;
const getServerMounted = () => false as const;

export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getClientMounted,
    getServerMounted,
  );
}
