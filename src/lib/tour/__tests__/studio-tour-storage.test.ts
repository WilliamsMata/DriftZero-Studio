import { describe, expect, it } from "vitest";
import {
  hasSeenStudioTour,
  markStudioTourSeen,
} from "@/lib/tour/studio-tour-storage";

describe("studio tour storage", () => {
  it("is a safe no-op without a browser window", () => {
    expect(hasSeenStudioTour()).toBe(false);
    expect(() => markStudioTourSeen()).not.toThrow();
  });
});
