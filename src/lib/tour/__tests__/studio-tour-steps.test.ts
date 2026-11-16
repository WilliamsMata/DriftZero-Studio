import { describe, expect, it } from "vitest";
import {
  STUDIO_TOUR_STEPS,
  studioTourSelector,
} from "@/lib/tour/studio-tour-steps";

const EXPECTED_STEP_IDS = [
  "showcase-presets",
  "product-anchor",
  "creative-direction",
  "model-capabilities",
  "execution-pipeline",
  "storyboard-qa",
  "commercial-player",
  "finops-ledger",
] as const;

describe("studio tour steps", () => {
  it("covers the current studio surface in workflow order", () => {
    expect(STUDIO_TOUR_STEPS.map((step) => step.id)).toEqual([
      ...EXPECTED_STEP_IDS,
    ]);
  });

  it("keeps every semantic id unique and addressable", () => {
    const ids = STUDIO_TOUR_STEPS.map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const step of STUDIO_TOUR_STEPS) {
      expect(step.title.trim()).not.toBe("");
      expect(step.description.trim()).not.toBe("");
      expect(studioTourSelector(step.id)).toBe(`[data-tour="${step.id}"]`);
    }
  });

  it("only opens the model drawer from the Create tab", () => {
    const drawerSteps = STUDIO_TOUR_STEPS.filter(
      (step) => step.mobile?.drawer !== undefined,
    );

    expect(drawerSteps).toHaveLength(1);
    expect(drawerSteps[0]?.id).toBe("model-capabilities");
    expect(drawerSteps[0]?.mobile?.tab).toBe("create");
  });
});
