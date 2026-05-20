import { describe, expect, it } from "vitest";

import { simplePlan } from "../fixtures/simplePlan";
import { buildModelSpec } from "./modelBuilder";

describe("buildModelSpec", () => {
  it("creates one wall mesh per wall and a floor mesh for simplePlan", () => {
    const model = buildModelSpec(simplePlan);

    expect(model.floor).toEqual({
      center: [4, 0, 2.625],
      size: [8, 0, 5.25],
    });
    expect(model.walls.map((wall) => wall.wallId)).toEqual([
      "north",
      "east",
      "south",
      "west",
      "partition",
    ]);
    expect(model.walls[0]).toEqual({
      wallId: "north",
      center: [4, 1.35, 0],
      size: [8, 2.7, 0.15],
      rotationY: 0,
    });
  });

  it("converts simplePlan floor size to approximately 8 by 5.25 meters", () => {
    const model = buildModelSpec(simplePlan);

    expect(model.floor.size[0]).toBeCloseTo(8);
    expect(model.floor.size[2]).toBeCloseTo(5.25);
  });

  it.each([
    ["zero", 0],
    ["negative", -80],
    ["NaN", Number.NaN],
  ])("falls back to default scale for %s pixelsPerMeter", (_label, scale) => {
    const model = buildModelSpec({
      ...simplePlan,
      scale: { pixelsPerMeter: scale },
    });

    expect(model.floor.size[0]).toBeCloseTo(8);
    expect(model.floor.size[2]).toBeCloseTo(5.25);
    expect(model.walls[0]?.center[0]).toBeCloseTo(4);
    expect(model.walls[0]?.size[0]).toBeCloseTo(8);
  });

  it("builds centered, rotated wall meshes for simplePlan vertical and reversed walls", () => {
    const model = buildModelSpec(simplePlan);
    const walls = new Map(model.walls.map((wall) => [wall.wallId, wall]));

    expect(walls.get("east")).toEqual({
      wallId: "east",
      center: [8, 1.35, 2.625],
      size: [5.25, 2.7, 0.15],
      rotationY: Math.PI / 2,
    });
    expect(walls.get("south")).toEqual({
      wallId: "south",
      center: [4, 1.35, 5.25],
      size: [8, 2.7, 0.15],
      rotationY: Math.PI,
    });
    expect(walls.get("west")).toEqual({
      wallId: "west",
      center: [0, 1.35, 2.625],
      size: [5.25, 2.7, 0.15],
      rotationY: -Math.PI / 2,
    });
  });

  it("uses wall height for wall mesh vertical center and size", () => {
    const plan = {
      ...simplePlan,
      walls: simplePlan.walls.map((wall) => ({
        ...wall,
        height: wall.id === "north" ? 3.2 : wall.height,
      })),
    };

    const model = buildModelSpec(plan);

    expect(model.walls[0]?.center[1]).toBeCloseTo(1.6);
    expect(model.walls[0]?.size[1]).toBeCloseTo(3.2);
  });

  it("sizes the floor from the structural wall envelope instead of full canvas bounds", () => {
    const model = buildModelSpec({
      width: 1000,
      height: 1000,
      scale: { pixelsPerMeter: 100 },
      walls: [
        {
          id: "north",
          segment: { start: { x: 100, y: 200 }, end: { x: 900, y: 200 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "east",
          segment: { start: { x: 900, y: 200 }, end: { x: 900, y: 800 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "south",
          segment: { start: { x: 900, y: 800 }, end: { x: 100, y: 800 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "west",
          segment: { start: { x: 100, y: 800 }, end: { x: 100, y: 200 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
      ],
      openings: [],
    });

    expect(model.floor.center).toEqual([5, 0, 5]);
    expect(model.floor.size).toEqual([8, 0, 6]);
  });

  it("rescales tiny extracted footprints so default wall height stays proportional", () => {
    const model = buildModelSpec({
      width: 80,
      height: 80,
      scale: { pixelsPerMeter: 80 },
      walls: [
        {
          id: "north",
          segment: { start: { x: 4, y: 4 }, end: { x: 28, y: 4 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "east",
          segment: { start: { x: 28, y: 4 }, end: { x: 28, y: 22 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "south",
          segment: { start: { x: 28, y: 22 }, end: { x: 4, y: 22 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
        {
          id: "west",
          segment: { start: { x: 4, y: 22 }, end: { x: 4, y: 4 } },
          height: 2.7,
          thicknessMeters: 0.15,
          exterior: true,
        },
      ],
      openings: [],
    });

    expect(model.floor.size[0]).toBeCloseTo(8);
    expect(model.floor.size[2]).toBeCloseTo(6);
    expect(model.walls[0]?.size[0]).toBeCloseTo(8);
    expect(model.walls[0]?.size[1]).toBeCloseTo(2.7);
  });

  it("clamps unusually tall walls to a residential height cap", () => {
    const model = buildModelSpec({
      ...simplePlan,
      walls: simplePlan.walls.map((wall) => ({
        ...wall,
        height: 8,
      })),
    });

    expect(model.floor.size[2]).toBeCloseTo(5.25);
    expect(model.walls[0]?.size[1]).toBeCloseTo(3.6);
    expect(model.walls[0]?.center[1]).toBeCloseTo(1.8);
  });
});
