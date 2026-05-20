import type { Plan, Segment2 } from "../domain/geometry";
import { segmentLength } from "../domain/geometry";
import { mergeCollinearSegments, snapSegmentEndpoints } from "./segments";

const DARK_PIXEL_THRESHOLD = 128;
const MIN_WALL_RUN_PIXELS = 4;
const MERGE_GAP_TOLERANCE = 1;
const SNAP_ENDPOINT_TOLERANCE = 2;
const STROKE_BAND_TOLERANCE = 2;
const STRUCTURAL_CONNECT_TOLERANCE = 2;
const SECONDARY_STRUCTURAL_COMPONENT_RATIO = 0.35;
const MAX_WALL_SEGMENT_CANDIDATES = 4_096;
const DEFAULT_PIXELS_PER_METER = 80;
const DEFAULT_WALL_HEIGHT = 2.7;
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

type StructuralComponent = {
  segmentIndexes: number[];
  totalLength: number;
};

type SegmentBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

function valueInRange(value: number, start: number, end: number): boolean {
  return (
    value >= start - STRUCTURAL_CONNECT_TOLERANCE &&
    value <= end + STRUCTURAL_CONNECT_TOLERANCE
  );
}

function normalizedSegmentsConnect(
  first: NormalizedSegment,
  second: NormalizedSegment,
): boolean {
  if (first.axis === second.axis) {
    const coordinateDistance = Math.abs(first.coordinate - second.coordinate);
    const gap =
      Math.max(first.start, second.start) - Math.min(first.end, second.end);

    return (
      coordinateDistance <= STRUCTURAL_CONNECT_TOLERANCE &&
      gap <= STRUCTURAL_CONNECT_TOLERANCE
    );
  }

  const horizontal = first.axis === "horizontal" ? first : second;
  const vertical = first.axis === "vertical" ? first : second;

  return (
    valueInRange(vertical.coordinate, horizontal.start, horizontal.end) &&
    valueInRange(horizontal.coordinate, vertical.start, vertical.end)
  );
}

function segmentsConnect(first: Segment2, second: Segment2): boolean {
  const normalizedFirst = classifySegment(first);
  const normalizedSecond = classifySegment(second);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  return normalizedSegmentsConnect(normalizedFirst, normalizedSecond);
}

function buildStructuralComponents(
  segments: Segment2[],
): StructuralComponent[] {
  const adjacency = segments.map(() => new Set<number>());

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < segments.length;
      secondIndex += 1
    ) {
      if (!segmentsConnect(segments[firstIndex], segments[secondIndex])) {
        continue;
      }

      adjacency[firstIndex].add(secondIndex);
      adjacency[secondIndex].add(firstIndex);
    }
  }

  const visited = new Set<number>();
  const components: StructuralComponent[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    if (visited.has(index)) {
      continue;
    }

    const segmentIndexes: number[] = [];
    const pending = [index];
    visited.add(index);

    while (pending.length > 0) {
      const currentIndex = pending.pop();

      if (currentIndex === undefined) {
        continue;
      }

      segmentIndexes.push(currentIndex);

      for (const nextIndex of adjacency[currentIndex]) {
        if (visited.has(nextIndex)) {
          continue;
        }

        visited.add(nextIndex);
        pending.push(nextIndex);
      }
    }

    components.push({
      segmentIndexes,
      totalLength: segmentIndexes.reduce(
        (total, segmentIndex) => total + segmentLength(segments[segmentIndex]),
        0,
      ),
    });
  }

  return components.sort((a, b) => b.totalLength - a.totalLength);
}

function filterStructuralSegments(segments: Segment2[]): Segment2[] {
  if (segments.length <= 1) {
    return segments;
  }

  const components = buildStructuralComponents(segments);
  const primaryComponent = components[0];

  if (!primaryComponent) {
    return segments;
  }

  const minimumSecondaryLength =
    primaryComponent.totalLength * SECONDARY_STRUCTURAL_COMPONENT_RATIO;
  const structuralIndexes = new Set<number>();

  for (const component of components) {
    if (
      component !== primaryComponent &&
      component.totalLength < minimumSecondaryLength
    ) {
      continue;
    }

    for (const segmentIndex of component.segmentIndexes) {
      structuralIndexes.add(segmentIndex);
    }
  }

  return segments.filter((_, index) => structuralIndexes.has(index));
}

function structuralBounds(segments: Segment2[]): SegmentBounds | null {
  if (segments.length === 0) {
    return null;
  }

  return segments.reduce<SegmentBounds>(
    (bounds, segment) => ({
      minX: Math.min(bounds.minX, segment.start.x, segment.end.x),
      maxX: Math.max(bounds.maxX, segment.start.x, segment.end.x),
      minY: Math.min(bounds.minY, segment.start.y, segment.end.y),
      maxY: Math.max(bounds.maxY, segment.start.y, segment.end.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function isNear(value: number, target: number): boolean {
  return Math.abs(value - target) <= STRUCTURAL_CONNECT_TOLERANCE;
}

function isExteriorSegment(
  segment: Segment2,
  bounds: SegmentBounds | null,
): boolean {
  if (!bounds) {
    return true;
  }

  const normalized = classifySegment(segment);

  if (!normalized) {
    return true;
  }

  if (normalized.axis === "horizontal") {
    return (
      isNear(normalized.coordinate, bounds.minY) ||
      isNear(normalized.coordinate, bounds.maxY)
    );
  }

  return (
    isNear(normalized.coordinate, bounds.minX) ||
    isNear(normalized.coordinate, bounds.maxX)
  );
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

  const structuralSegments = mergeCollinearSegments(
    snappedSegments,
    MERGE_GAP_TOLERANCE,
  ).filter((segment) => segmentLength(segment) >= MIN_WALL_SEGMENT_LENGTH);

  return filterStructuralSegments(structuralSegments);
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
  const bounds = structuralBounds(segments);

  return {
    width: canvas.width,
    height: canvas.height,
    scale: {
      pixelsPerMeter: DEFAULT_PIXELS_PER_METER,
    },
    walls: segments.map((segment, index) => ({
      id: `wall-${index + 1}`,
      segment,
      height: DEFAULT_WALL_HEIGHT,
      thicknessMeters: DEFAULT_WALL_THICKNESS_METERS,
      exterior: isExteriorSegment(segment, bounds),
    })),
    openings: [],
  };
}
