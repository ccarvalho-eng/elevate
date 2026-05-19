import { describe, expect, it } from "vitest";

import { distance, midpoint, segmentLength } from "./geometry";

describe("geometry helpers", () => {
  it("calculates segment length from endpoints", () => {
    expect(
      segmentLength({
        start: { x: 0, y: 0 },
        end: { x: 3, y: 4 },
      }),
    ).toBe(5);
  });

  it("calculates midpoint from endpoints", () => {
    expect(
      midpoint({
        start: { x: 2, y: 4 },
        end: { x: 6, y: 10 },
      }),
    ).toEqual({ x: 4, y: 7 });
  });

  it("calculates distance between points", () => {
    expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });
});
