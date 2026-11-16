import { STUDIO_TOUR_SEEN_STORAGE_KEY } from "@/lib/tour/studio-tour-steps";

export const STUDIO_TOUR_SEEN_EVENT = "driftzero:tour-seen";

export function hasSeenStudioTour(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(STUDIO_TOUR_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markStudioTourSeen(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STUDIO_TOUR_SEEN_STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }

  window.dispatchEvent(new Event(STUDIO_TOUR_SEEN_EVENT));
}
