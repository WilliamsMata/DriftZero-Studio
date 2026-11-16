"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import { toast } from "sonner";
import { useViewportTier, type ViewportTier } from "@/hooks/use-viewport-tier";
import {
  STUDIO_TOUR_STEPS,
  studioTourSelector,
  type StudioTourStep,
} from "@/lib/tour/studio-tour-steps";
import { markStudioTourSeen } from "@/lib/tour/studio-tour-storage";
import { useStudioStore } from "@/store/use-studio-store";

const STEP_SETTLE_MS = 180;
const TARGET_WAIT_MS = 1200;
const DRAWER_CLOSE_WAIT_MS = 1200;
const CATALOG_WAIT_MS = 5000;
const CAMPAIGN_WAIT_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function isElementRenderable(element: HTMLElement): boolean {
  if (!element.isConnected) return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity) === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function waitForPredicate(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 60,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (predicate()) return true;
    await sleep(intervalMs);
  }

  return predicate();
}

async function waitForTarget(
  selector: string,
  timeoutMs = TARGET_WAIT_MS,
): Promise<HTMLElement | null> {
  const deadline = performance.now() + timeoutMs;
  let previousPosition: { top: number; left: number } | null = null;
  let stableChecks = 0;

  while (performance.now() < deadline) {
    const element = document.querySelector<HTMLElement>(selector);

    if (element && isElementRenderable(element)) {
      const rect = element.getBoundingClientRect();

      if (
        previousPosition !== null &&
        Math.abs(rect.top - previousPosition.top) < 0.5 &&
        Math.abs(rect.left - previousPosition.left) < 0.5
      ) {
        stableChecks += 1;
      } else {
        stableChecks = 0;
      }

      previousPosition = { top: rect.top, left: rect.left };

      if (stableChecks >= 2) return element;
    } else {
      previousPosition = null;
      stableChecks = 0;
    }

    await sleep(60);
  }

  const fallback = document.querySelector<HTMLElement>(selector);
  return fallback && isElementRenderable(fallback) ? fallback : null;
}

async function waitForDrawerClosed(
  timeoutMs = DRAWER_CLOSE_WAIT_MS,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    const popups = document.querySelectorAll<HTMLElement>(
      '[data-slot="drawer-popup"]',
    );
    const drawerStillVisible = Array.from(popups).some((popup) =>
      isElementRenderable(popup),
    );

    if (!drawerStillVisible) return;
    await sleep(60);
  }
}

function ensureTargetInView(target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const fullyVisible =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  if (fullyVisible) return;

  target.scrollIntoView({
    block: "center",
    inline: "center",
    behavior: "auto",
  });
}

/** Load the first baked showcase so every spotlight has real campaign data. */
async function ensureShowcaseCampaign(): Promise<void> {
  if (useStudioStore.getState().campaign) return;

  await waitForPredicate(() => {
    const state = useStudioStore.getState();
    return state.presets.length > 0 || state.catalogStatus === "error";
  }, CATALOG_WAIT_MS);

  const state = useStudioStore.getState();
  if (state.campaign) return;

  const preset = state.presets[0];
  if (!preset) return;

  state.loadPreset(preset.id);

  await waitForPredicate(
    () => useStudioStore.getState().campaign !== null,
    CAMPAIGN_WAIT_MS,
  );
  await sleep(STEP_SETTLE_MS);
  await nextFrame();
  await nextFrame();
}

/**
 * Applies every tab/drawer transition needed for a step and confirms its
 * `[data-tour]` target is mounted and stable. Returns false when the current
 * viewport cannot show the target.
 */
async function prepareStudioTourStep(
  step: StudioTourStep,
  tier: ViewportTier,
): Promise<boolean> {
  if (tier === "mobile") {
    const desiredDrawer = step.mobile?.drawer ?? null;
    const currentDrawer = useStudioStore.getState().mobileDrawer;

    if (currentDrawer !== null && currentDrawer !== desiredDrawer) {
      useStudioStore.getState().closeMobileDrawer();
      await waitForDrawerClosed();
    }

    if (step.mobile?.tab) {
      const currentTab = useStudioStore.getState().mobileTab;
      if (currentTab !== step.mobile.tab) {
        useStudioStore.getState().setMobileTab(step.mobile.tab);
      }
    }

    if (desiredDrawer) {
      useStudioStore.getState().openMobileDrawer(desiredDrawer);
    }
  } else if (tier === "tablet" && step.tabletTab) {
    const currentTab = useStudioStore.getState().tabletRightTab;
    if (currentTab !== step.tabletTab) {
      useStudioStore.getState().setTabletRightTab(step.tabletTab);
    }
  }

  await sleep(STEP_SETTLE_MS);

  if (tier === "mobile" && !step.mobile?.drawer) {
    // Covers the exit animation even when the store already reports null.
    await waitForDrawerClosed();
  }

  await nextFrame();
  await nextFrame();

  const target = await waitForTarget(studioTourSelector(step.id));
  if (!target) return false;

  ensureTargetInView(target);
  await nextFrame();
  await nextFrame();
  return true;
}

export interface StudioTourControls {
  startTour: () => Promise<void>;
  stopTour: () => void;
  isTourActive: () => boolean;
}

export function useStudioTour(): StudioTourControls {
  const tier = useViewportTier();
  const tierRef = useRef<ViewportTier>(tier);
  const previousTierRef = useRef<ViewportTier>(tier);
  const driverRef = useRef<Driver | null>(null);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const transitioningRef = useRef(false);

  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (previousTierRef.current === tier) return;

    previousTierRef.current = tier;

    // The old shell unmounts on a responsive breakpoint change, so the active
    // spotlight would point at a detached element. Close cleanly instead.
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, [tier]);

  const stopTour = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const isTourActive = useCallback(() => {
    return driverRef.current?.isActive() ?? false;
  }, []);

  const navigate = useCallback(async (direction: 1 | -1) => {
    const driverObj = driverRef.current;
    if (!driverObj?.isActive() || transitioningRef.current) return;

    transitioningRef.current = true;

    try {
      const currentIndex = driverObj.getActiveIndex() ?? 0;
      let candidateIndex = currentIndex + direction;

      while (
        candidateIndex >= 0 &&
        candidateIndex < STUDIO_TOUR_STEPS.length
      ) {
        const candidate = STUDIO_TOUR_STEPS[candidateIndex];
        if (!candidate) break;

        const available = await prepareStudioTourStep(
          candidate,
          tierRef.current,
        );

        if (!driverObj.isActive()) return;

        if (available) {
          if (candidateIndex === currentIndex + direction) {
            if (direction === 1) {
              driverObj.moveNext();
            } else {
              driverObj.movePrevious();
            }
          } else {
            driverObj.moveTo(candidateIndex);
          }
          return;
        }

        candidateIndex += direction;
      }

      if (direction === 1) {
        if (currentIndex >= STUDIO_TOUR_STEPS.length - 1) {
          // Driver owns the final "Done" transition and destroy reason.
          driverObj.moveNext();
        } else {
          markStudioTourSeen();
          driverObj.destroy();
        }
      }
    } finally {
      transitioningRef.current = false;
    }
  }, []);

  const startTour = useCallback(async () => {
    if (startingRef.current) return;

    const existing = driverRef.current;
    if (existing?.isActive()) {
      existing.destroy();
    }
    driverRef.current = null;

    startingRef.current = true;

    try {
      await ensureShowcaseCampaign();
      if (!mountedRef.current) return;

      const activeTier = tierRef.current;

      if (activeTier === "mobile") {
        const state = useStudioStore.getState();
        state.setMobileTab("create");
        if (state.mobileDrawer !== null) state.closeMobileDrawer();
      }

      await sleep(STEP_SETTLE_MS);
      await waitForDrawerClosed();
      await nextFrame();

      let firstAvailableIndex = 0;

      for (let index = 0; index < STUDIO_TOUR_STEPS.length; index += 1) {
        const step = STUDIO_TOUR_STEPS[index];
        if (!step) continue;

        const available = await prepareStudioTourStep(step, activeTier);
        if (available) {
          firstAvailableIndex = index;
          break;
        }
      }

      if (!mountedRef.current) return;

      const driverObj = driver({
        steps: STUDIO_TOUR_STEPS.map((step) => ({
          element: studioTourSelector(step.id),
          focus: step.focus,
          popover: {
            title: step.title,
            description: step.description,
            side: step.side,
            align: step.align,
          },
        })),
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        closeBtnLabel: "Skip tour",
        allowClose: true,
        allowKeyboardControl: true,
        overlayColor: "#050505",
        overlayOpacity: 0.78,
        stagePadding: 8,
        stageRadius: 14,
        popoverOffset: 12,
        popoverClass: "driftzero-tour-popover",
        smoothScroll: true,
        scrollIntoView: { block: "center", inline: "center" },
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = "Skip";
        },
        onNextClick: () => {
          void navigate(1);
        },
        onPrevClick: () => {
          void navigate(-1);
        },
        onDestroyed: (_element, _step, options) => {
          if (
            options.reason === "done" ||
            options.reason === "close" ||
            options.reason === "escape" ||
            options.reason === "overlay"
          ) {
            markStudioTourSeen();
          }

          if (tierRef.current === "mobile") {
            useStudioStore.getState().closeMobileDrawer();
          }

          driverRef.current = null;
        },
      });

      driverRef.current = driverObj;
      driverObj.drive(firstAvailableIndex);
    } catch (error) {
      driverRef.current?.destroy();
      driverRef.current = null;

      toast.error("Studio tour could not start", {
        description:
          error instanceof Error && error.message.trim() !== ""
            ? error.message
            : "The guided tour could not open on this viewport.",
        duration: 5000,
      });
    } finally {
      startingRef.current = false;
    }
  }, [navigate]);

  return { startTour, stopTour, isTourActive };
}
