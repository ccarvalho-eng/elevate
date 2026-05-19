import { describe, expect, it } from "vitest";

import { mergeCollinearSegments, snapSegmentEndpoints } from "./segments";

describe("mergeCollinearSegments", () => {
  it("merges horizontal collinear segments with a small gap into one segment", () => {
    const merged = mergeCollinearSegments(
      [
        { start: { x: 0, y: 10 }, end: { x: 20, y: 10 } },
        { start: { x: 23, y: 10 }, end: { x: 40, y: 10 } },
      ],
      3,
    );

    expect(merged).toEqual([{ start: { x: 0, y: 10 }, end: { x: 40, y: 10 } }]);
  });
});

describe("snapSegmentEndpoints", () => {
  it("snaps endpoints that nearly touch", () => {
    const snapped = snapSegmentEndpoints(
      [
        { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        { start: { x: 11, y: 0 }, end: { x: 11, y: 10 } },
      ],
      2,
    );

    expect(snapped[0]?.end).toEqual(snapped[1]?.start);
  });

  it("does not collapse a valid short segment into a zero-length segment", () => {
    const snapped = snapSegmentEndpoints(
      [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
      2,
    );

    expect(snapped).toEqual([{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }]);
  });
});
