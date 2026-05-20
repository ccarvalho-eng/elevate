import { describe, expect, it } from "vitest";

import { segmentLength, type Segment2 } from "../domain/geometry";
import {
  BlueprintExtractionError,
  extractPlanFromCanvas,
} from "./planExtractor";

type Pixel = [number, number, number, number];

function createHighContrastCanvas(
  width: number,
  height: number,
  draw: (setPixel: (x: number, y: number, pixel: Pixel) => void) => void,
): HTMLCanvasElement {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }

  const setPixel = (x: number, y: number, pixel: Pixel) => {
    const index = (y * width + x) * 4;
    data[index] = pixel[0];
    data[index + 1] = pixel[1];
    data[index + 2] = pixel[2];
    data[index + 3] = pixel[3];
  };

  draw(setPixel);

  return {
    width,
    height,
    getContext: (contextType: string) => {
      if (contextType !== "2d") {
        return null;
      }

      return {
        getImageData: () => ({
          data,
          width,
          height,
        }),
      };
    },
  } as HTMLCanvasElement;
}

function strokeRectangle(
  width: number,
  height: number,
  inset: number,
  strokeWidth = 1,
): HTMLCanvasElement {
  return createHighContrastCanvas(width, height, (setPixel) => {
    const maxX = width - inset - 1;
    const maxY = height - inset - 1;

    for (let x = inset; x < width - inset; x += 1) {
      for (let offset = 0; offset < strokeWidth; offset += 1) {
        setPixel(x, inset + offset, [0, 0, 0, 255]);
        setPixel(x, maxY - offset, [0, 0, 0, 255]);
      }
    }

    for (let y = inset; y < height - inset; y += 1) {
      for (let offset = 0; offset < strokeWidth; offset += 1) {
        setPixel(inset + offset, y, [0, 0, 0, 255]);
        setPixel(maxX - offset, y, [0, 0, 0, 255]);
      }
    }
  });
}

function linePlanWithInteriorNoise(): HTMLCanvasElement {
  return createHighContrastCanvas(40, 32, (setPixel) => {
    for (let x = 4; x <= 35; x += 1) {
      setPixel(x, 4, [0, 0, 0, 255]);
      setPixel(x, 27, [0, 0, 0, 255]);
    }

    for (let y = 4; y <= 27; y += 1) {
      setPixel(4, y, [0, 0, 0, 255]);
      setPixel(20, y, [0, 0, 0, 255]);
      setPixel(35, y, [0, 0, 0, 255]);
    }

    for (let x = 10; x <= 14; x += 1) {
      setPixel(x, 12, [0, 0, 0, 255]);
      setPixel(x, 16, [0, 0, 0, 255]);
    }

    for (let y = 12; y <= 16; y += 1) {
      setPixel(10, y, [0, 0, 0, 255]);
      setPixel(14, y, [0, 0, 0, 255]);
    }
  });
}

function rectangleWithDimensionLine(): HTMLCanvasElement {
  return createHighContrastCanvas(40, 32, (setPixel) => {
    for (let x = 4; x <= 35; x += 1) {
      setPixel(x, 6, [0, 0, 0, 255]);
      setPixel(x, 27, [0, 0, 0, 255]);
    }

    for (let y = 6; y <= 27; y += 1) {
      setPixel(4, y, [0, 0, 0, 255]);
      setPixel(35, y, [0, 0, 0, 255]);
    }

    for (let x = 8; x <= 31; x += 1) {
      setPixel(x, 2, [0, 0, 0, 255]);
    }

    for (let y = 1; y <= 3; y += 1) {
      setPixel(8, y, [0, 0, 0, 255]);
      setPixel(31, y, [0, 0, 0, 255]);
    }
  });
}

function doubleLineRectangle(): HTMLCanvasElement {
  return createHighContrastCanvas(40, 32, (setPixel) => {
    for (let x = 4; x <= 35; x += 1) {
      setPixel(x, 4, [0, 0, 0, 255]);
      setPixel(x, 27, [0, 0, 0, 255]);
    }

    for (let x = 6; x <= 33; x += 1) {
      setPixel(x, 6, [0, 0, 0, 255]);
      setPixel(x, 25, [0, 0, 0, 255]);
    }

    for (let y = 4; y <= 27; y += 1) {
      setPixel(4, y, [0, 0, 0, 255]);
      setPixel(35, y, [0, 0, 0, 255]);
    }

    for (let y = 6; y <= 25; y += 1) {
      setPixel(6, y, [0, 0, 0, 255]);
      setPixel(33, y, [0, 0, 0, 255]);
    }
  });
}

function noisySegmentCandidateCanvas(width: number, height: number) {
  return createHighContrastCanvas(width, height, (setPixel) => {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width - 3; x += 6) {
        setPixel(x, y, [0, 0, 0, 255]);
        setPixel(x + 1, y, [0, 0, 0, 255]);
        setPixel(x + 2, y, [0, 0, 0, 255]);
        setPixel(x + 3, y, [0, 0, 0, 255]);
      }
    }
  });
}

function segmentKey(segment: Segment2): string {
  return `${segment.start.x},${segment.start.y}->${segment.end.x},${segment.end.y}`;
}

function wallSegmentKeys(canvas: HTMLCanvasElement): string[] {
  return extractPlanFromCanvas(canvas)
    .walls.map((wall) => wall.segment)
    .map(segmentKey)
    .sort();
}

describe("extractPlanFromCanvas", () => {
  it("extracts rough walls from a simple black stroked rectangle canvas", () => {
    const canvas = strokeRectangle(32, 24, 4);

    const plan = extractPlanFromCanvas(canvas);

    expect(plan.width).toBe(32);
    expect(plan.height).toBe(24);
    expect(
      plan.walls
        .map((wall) => wall.segment)
        .map(segmentKey)
        .sort(),
    ).toEqual(["27,4->27,19", "4,19->27,19", "4,4->27,4", "4,4->4,19"]);
    expect(plan.walls.every((wall) => segmentLength(wall.segment) > 0)).toBe(
      true,
    );
    expect(plan.walls.every((wall) => wall.height === 2.7)).toBe(true);
    expect(plan.openings).toEqual([]);
  });

  it("collapses a 3px stroked rectangle into centerline wall segments", () => {
    const canvas = strokeRectangle(32, 24, 4, 3);

    expect(wallSegmentKeys(canvas)).toEqual([
      "26,5->26,18",
      "5,18->26,18",
      "5,5->26,5",
      "5,5->5,18",
    ]);
  });

  it("ignores disconnected furniture-like shapes inside structural walls", () => {
    const canvas = linePlanWithInteriorNoise();

    expect(wallSegmentKeys(canvas)).toEqual([
      "20,4->20,27",
      "35,4->35,27",
      "4,27->35,27",
      "4,4->35,4",
      "4,4->4,27",
    ]);
  });

  it("marks connected interior partitions as non-exterior walls", () => {
    const plan = extractPlanFromCanvas(linePlanWithInteriorNoise());
    const wallsBySegment = new Map(
      plan.walls.map((wall) => [segmentKey(wall.segment), wall]),
    );

    expect(wallsBySegment.get("20,4->20,27")).toMatchObject({
      exterior: false,
    });
    expect(wallsBySegment.get("4,4->4,27")).toMatchObject({
      exterior: true,
    });
    expect(wallsBySegment.get("35,4->35,27")).toMatchObject({
      exterior: true,
    });
  });

  it("ignores unconnected dimension lines outside the structural wall graph", () => {
    const canvas = rectangleWithDimensionLine();

    expect(wallSegmentKeys(canvas)).toEqual([
      "35,6->35,27",
      "4,27->35,27",
      "4,6->35,6",
      "4,6->4,27",
    ]);
  });

  it("collapses close double-line walls into one structural centerline", () => {
    const canvas = doubleLineRectangle();

    expect(wallSegmentKeys(canvas)).toEqual([
      "34,5->34,26",
      "5,26->34,26",
      "5,5->34,5",
      "5,5->5,26",
    ]);
  });

  it("rejects noisy input before unbounded endpoint snapping work", () => {
    const canvas = noisySegmentCandidateCanvas(192, 192);

    try {
      extractPlanFromCanvas(canvas);
      throw new Error("Expected extraction to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BlueprintExtractionError);
      expect(error).toMatchObject({
        code: "too_many_wall_candidates",
        details: { count: 4_097, limit: 4_096 },
      });
    }
  });
});
