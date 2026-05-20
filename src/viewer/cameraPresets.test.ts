import { describe, expect, it } from "vitest";

import {
  getCameraPreset,
  type CameraPresetName,
  type ModelBounds,
} from "./cameraPresets";

const bounds: ModelBounds = {
  min: [0, 0, 0],
  max: [8, 3, 5],
};

describe("getCameraPreset", () => {
  it.each([
    ["roof-off", "Roof-off"],
    ["exterior", "Exterior"],
    ["front", "Front"],
    ["side", "Side"],
    ["interior", "Interior"],
  ] satisfies [CameraPresetName, string][])(
    "returns a labeled %s preset with a target inside the model",
    (name, label) => {
      const preset = getCameraPreset(name, bounds);

      expect(preset.label).toBe(label);
      expect(preset.target[0]).toBeGreaterThanOrEqual(bounds.min[0]);
      expect(preset.target[0]).toBeLessThanOrEqual(bounds.max[0]);
      expect(preset.target[1]).toBeGreaterThanOrEqual(bounds.min[1]);
      expect(preset.target[1]).toBeLessThanOrEqual(bounds.max[1]);
      expect(preset.target[2]).toBeGreaterThanOrEqual(bounds.min[2]);
      expect(preset.target[2]).toBeLessThanOrEqual(bounds.max[2]);
    },
  );

  it("positions the roof-off camera above the model", () => {
    const preset = getCameraPreset("roof-off", bounds);

    expect(preset.position[1]).toBeGreaterThan(bounds.max[1]);
    expect(preset.position[0]).toBeCloseTo(4);
    expect(preset.position[2]).toBeCloseTo(2.5);
  });

  it("positions the exterior camera outside model bounds", () => {
    const preset = getCameraPreset("exterior", bounds);

    expect(preset.position[0]).toBeGreaterThan(bounds.max[0]);
    expect(preset.position[2]).toBeGreaterThan(bounds.max[2]);
    expect(preset.position[1]).toBeGreaterThan(bounds.min[1]);
  });

  it("normalizes degenerate model bounds to usable camera positions", () => {
    const preset = getCameraPreset("front", {
      min: [2, 0, 2],
      max: [2, 0, 2],
    });

    expect(preset.position.every(Number.isFinite)).toBe(true);
    expect(preset.target.every(Number.isFinite)).toBe(true);
    expect(preset.position[2]).toBeLessThan(preset.target[2]);
  });
});
