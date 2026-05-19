import type { Plan, Segment2 } from "../domain/geometry";
import { segmentLength } from "../domain/geometry";
import { mergeCollinearSegments, snapSegmentEndpoints } from "./segments";

const DARK_PIXEL_THRESHOLD = 128;
const MIN_WALL_RUN_PIXELS = 4;
const MERGE_GAP_TOLERANCE = 1;
const SNAP_ENDPOINT_TOLERANCE = 2;
const STROKE_BAND_TOLERANCE = 1;
const MAX_WALL_SEGMENT_CANDIDATES = 4_096;
const DEFAULT_PIXELS_PER_METER = 80;
const DEFAULT_WALL_THICKNESS_METERS = 0.15;
const MIN_WALL_SEGMENT_LENGTH = 0.000001;

type SegmentAxis = "horizontal" | "vertical";

type ExtractionErrorCode = "too_many_wall_candidates";

type ExtractionErrorDetails = {
  count: number;
  limit: number;
};

type NormalizedSegment = {
  axis: SegmentAxis;
  coordinate: number;
  start: number;
  end: number;
};

type StrokeBand = {
  axis: SegmentAxis;
  minCoordinate: number;
  maxCoordinate: number;
  start: number;
  end: number;
};

type SegmentCollector = {
  segments: Segment2[];
  push: (segment: Segment2) => void;
};

export class BlueprintExtractionError extends Error {
  code: ExtractionErrorCode;
  details: ExtractionErrorDetails;

  constructor(code: ExtractionErrorCode, details: ExtractionErrorDetails) {
    super(`Blueprint extraction failed: ${code}.`);
    this.name = "BlueprintExtractionError";
    this.code = code;
    this.details = details;
  }
}

function isDarkPixel(data: Uint8ClampedArray, index: number): boolean {
  const red = data[index] ?? 255;
  const green = data[index + 1] ?? 255;
  const blue = data[index + 2] ?? 255;
  const alpha = data[index + 3] ?? 0;
  const luminance = (red + green + blue) / 3;

  return alpha > 0 && luminance < DARK_PIXEL_THRESHOLD;
}

function pixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function classifySegment(segment: Segment2): NormalizedSegment | null {
  if (segment.start.y === segment.end.y) {
    return {
      axis: "horizontal",
      coordinate: segment.start.y,
      start: Math.min(segment.start.x, segment.end.x),
      end: Math.max(segment.start.x, segment.end.x),
    };
  }

  if (segment.start.x === segment.end.x) {
    return {
      axis: "vertical",
      coordinate: segment.start.x,
      start: Math.min(segment.start.y, segment.end.y),
      end: Math.max(segment.start.y, segment.end.y),
    };
  }

  return null;
}

function denormalizeSegment(segment: NormalizedSegment): Segment2 {
  if (segment.axis === "horizontal") {
    return {
      start: { x: segment.start, y: segment.coordinate },
      end: { x: segment.end, y: segment.coordinate },
    };
  }

  return {
    start: { x: segment.coordinate, y: segment.start },
    end: { x: segment.coordinate, y: segment.end },
  };
}

function rangesOverlap(a: NormalizedSegment, b: StrokeBand): boolean {
  return Math.min(a.end, b.end) - Math.max(a.start, b.start) >= 0;
}

function collapseStrokeBandsForAxis(
  segments: NormalizedSegment[],
): NormalizedSegment[] {
  const bands: StrokeBand[] = [];

  for (const segment of segments) {
    const band = bands.find(
      (candidate) =>
        segment.axis === candidate.axis &&
        segment.coordinate <= candidate.maxCoordinate + STROKE_BAND_TOLERANCE &&
        rangesOverlap(segment, candidate),
    );

    if (band) {
      band.minCoordinate = Math.min(band.minCoordinate, segment.coordinate);
      band.maxCoordinate = Math.max(band.maxCoordinate, segment.coordinate);
      band.start = Math.min(band.start, segment.start);
      band.end = Math.max(band.end, segment.end);
      continue;
    }

    bands.push({
      axis: segment.axis,
      minCoordinate: segment.coordinate,
      maxCoordinate: segment.coordinate,
      start: segment.start,
      end: segment.end,
    });
  }

  return bands.map((band) => ({
    axis: band.axis,
    coordinate: Math.round((band.minCoordinate + band.maxCoordinate) / 2),
    start: band.start,
    end: band.end,
  }));
}

function collapseStrokeBands(segments: Segment2[]): Segment2[] {
  const normalized = segments
    .map(classifySegment)
    .filter((segment): segment is NormalizedSegment => segment !== null);
  const horizontal = normalized
    .filter((segment) => segment.axis === "horizontal")
    .sort(
      (a, b) =>
        a.coordinate - b.coordinate || a.start - b.start || a.end - b.end,
    );
  const vertical = normalized
    .filter((segment) => segment.axis === "vertical")
    .sort(
      (a, b) =>
        a.coordinate - b.coordinate || a.start - b.start || a.end - b.end,
    );

  return [
    ...collapseStrokeBandsForAxis(horizontal),
    ...collapseStrokeBandsForAxis(vertical),
  ]
    .map(denormalizeSegment)
    .filter((segment) => segmentLength(segment) >= MIN_WALL_SEGMENT_LENGTH);
}

function assertCandidateLimit(count: number): void {
  if (count <= MAX_WALL_SEGMENT_CANDIDATES) {
    return;
  }

  throw new BlueprintExtractionError("too_many_wall_candidates", {
    count,
    limit: MAX_WALL_SEGMENT_CANDIDATES,
  });
}

function createSegmentCollector(): SegmentCollector {
  const segments: Segment2[] = [];

  return {
    segments,
    push: (segment: Segment2) => {
      const nextCount = segments.length + 1;
      assertCandidateLimit(nextCount);
      segments.push(segment);
    },
  };
}

function scanHorizontalSegments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  collector: SegmentCollector,
): void {
  for (let y = 0; y < height; y += 1) {
    let runStart: number | null = null;

    for (let x = 0; x <= width; x += 1) {
      const dark = x < width && isDarkPixel(data, pixelIndex(x, y, width));

      if (dark && runStart === null) {
        runStart = x;
        continue;
      }

      if (!dark && runStart !== null) {
        const runEnd = x - 1;

        if (runEnd - runStart + 1 >= MIN_WALL_RUN_PIXELS) {
          collector.push({
            start: { x: runStart, y },
            end: { x: runEnd, y },
          });
        }

        runStart = null;
      }
    }
  }
}

function scanVerticalSegments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  collector: SegmentCollector,
): void {
  for (let x = 0; x < width; x += 1) {
    let runStart: number | null = null;

    for (let y = 0; y <= height; y += 1) {
      const dark = y < height && isDarkPixel(data, pixelIndex(x, y, width));

      if (dark && runStart === null) {
        runStart = y;
        continue;
      }

      if (!dark && runStart !== null) {
        const runEnd = y - 1;

        if (runEnd - runStart + 1 >= MIN_WALL_RUN_PIXELS) {
          collector.push({
            start: { x, y: runStart },
            end: { x, y: runEnd },
          });
        }

        runStart = null;
      }
    }
  }
}

function extractSegments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Segment2[] {
  const scannedSegments = createSegmentCollector();
  scanHorizontalSegments(data, width, height, scannedSegments);
  scanVerticalSegments(data, width, height, scannedSegments);

  const strokeSegments = collapseStrokeBands(scannedSegments.segments);
  assertCandidateLimit(strokeSegments.length);

  const mergedSegments = mergeCollinearSegments(
    strokeSegments,
    MERGE_GAP_TOLERANCE,
  );
  const snappedSegments = snapSegmentEndpoints(
    mergedSegments,
    SNAP_ENDPOINT_TOLERANCE,
  );

  return mergeCollinearSegments(snappedSegments, MERGE_GAP_TOLERANCE).filter(
    (segment) => segmentLength(segment) >= MIN_WALL_SEGMENT_LENGTH,
  );
}

export function extractPlanFromCanvas(canvas: HTMLCanvasElement): Plan {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  const { data, width, height } = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const segments = extractSegments(data, width, height);

  return {
    width: canvas.width,
    height: canvas.height,
    scale: {
      pixelsPerMeter: DEFAULT_PIXELS_PER_METER,
    },
    walls: segments.map((segment, index) => ({
      id: `wall-${index + 1}`,
      segment,
      thicknessMeters: DEFAULT_WALL_THICKNESS_METERS,
      exterior: true,
    })),
    openings: [],
  };
}
