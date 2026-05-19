import type { Point2, Segment2 } from "../domain/geometry";
import { distance, segmentLength } from "../domain/geometry";

const MIN_SNAPPED_SEGMENT_LENGTH = 0.000001;

type SegmentAxis = "horizontal" | "vertical";

type NormalizedSegment = {
  axis: SegmentAxis;
  coordinate: number;
  start: number;
  end: number;
};

type SegmentEndpoint = "start" | "end";

type EndpointReference = {
  segmentIndex: number;
  endpoint: SegmentEndpoint;
  point: Point2;
  axis: SegmentAxis | null;
};

type EndpointCluster = {
  points: EndpointReference[];
  canonical: Point2;
};

type GridCell = {
  x: number;
  y: number;
};

function clonePoint(point: Point2): Point2 {
  return { x: point.x, y: point.y };
}

function cloneSegment(segment: Segment2): Segment2 {
  return {
    start: clonePoint(segment.start),
    end: clonePoint(segment.end),
  };
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

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function recalculateCanonical(points: EndpointReference[]): Point2 {
  const verticalPoints = points.filter(
    (reference) => reference.axis === "vertical",
  );
  const horizontalPoints = points.filter(
    (reference) => reference.axis === "horizontal",
  );

  return {
    x: Math.round(
      verticalPoints.length > 0
        ? average(verticalPoints.map((reference) => reference.point.x))
        : average(points.map((reference) => reference.point.x)),
    ),
    y: Math.round(
      horizontalPoints.length > 0
        ? average(horizontalPoints.map((reference) => reference.point.y))
        : average(points.map((reference) => reference.point.y)),
    ),
  };
}

function originalAxis(segment: Segment2): SegmentAxis | null {
  if (segment.start.y === segment.end.y) {
    return "horizontal";
  }

  if (segment.start.x === segment.end.x) {
    return "vertical";
  }

  return null;
}

function cellForPoint(point: Point2, cellSize: number): GridCell {
  return {
    x: Math.floor(point.x / cellSize),
    y: Math.floor(point.y / cellSize),
  };
}

function gridKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function addClusterToGrid(
  grid: Map<string, Set<number>>,
  clusterIndex: number,
  point: Point2,
  cellSize: number,
): void {
  const key = gridKey(cellForPoint(point, cellSize));
  const clusterIndexes = grid.get(key) ?? new Set<number>();
  clusterIndexes.add(clusterIndex);
  grid.set(key, clusterIndexes);
}

function nearbyClusterIndexes(
  grid: Map<string, Set<number>>,
  point: Point2,
  cellSize: number,
): number[] {
  const cell = cellForPoint(point, cellSize);
  const indexes = new Set<number>();

  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      const clusterIndexes = grid.get(
        gridKey({ x: cell.x + xOffset, y: cell.y + yOffset }),
      );

      if (!clusterIndexes) {
        continue;
      }

      for (const index of clusterIndexes) {
        indexes.add(index);
      }
    }
  }

  return [...indexes].sort((a, b) => a - b);
}

function clusterIncludesSegment(
  cluster: EndpointCluster,
  segmentIndex: number,
): boolean {
  return cluster.points.some(
    (reference) => reference.segmentIndex === segmentIndex,
  );
}

function findSnapClusterIndex(
  clusters: EndpointCluster[],
  grid: Map<string, Set<number>>,
  endpoint: EndpointReference,
  tolerance: number,
  cellSize: number,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const clusterIndex of nearbyClusterIndexes(
    grid,
    endpoint.point,
    cellSize,
  )) {
    const cluster = clusters[clusterIndex];

    if (!cluster || clusterIncludesSegment(cluster, endpoint.segmentIndex)) {
      continue;
    }

    const clusterDistance = distance(cluster.canonical, endpoint.point);

    if (
      clusterDistance <= tolerance &&
      (clusterDistance < bestDistance ||
        (clusterDistance === bestDistance &&
          (bestIndex === null || clusterIndex < bestIndex)))
    ) {
      bestIndex = clusterIndex;
      bestDistance = clusterDistance;
    }
  }

  return bestIndex;
}

export function mergeCollinearSegments(
  segments: Segment2[],
  gapTolerance: number,
): Segment2[] {
  const groups = new Map<string, NormalizedSegment[]>();
  const unmerged: Segment2[] = [];

  for (const segment of segments) {
    const normalized = classifySegment(segment);

    if (!normalized) {
      unmerged.push(cloneSegment(segment));
      continue;
    }

    const key = `${normalized.axis}:${normalized.coordinate}`;
    const group = groups.get(key) ?? [];
    group.push(normalized);
    groups.set(key, group);
  }

  const merged: Segment2[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.start - b.start);
    let current = sorted[0];

    if (!current) {
      continue;
    }

    for (const segment of sorted.slice(1)) {
      if (segment.start <= current.end + gapTolerance) {
        current = {
          ...current,
          end: Math.max(current.end, segment.end),
        };
        continue;
      }

      merged.push(denormalizeSegment(current));
      current = segment;
    }

    merged.push(denormalizeSegment(current));
  }

  return [...merged, ...unmerged];
}

export function snapSegmentEndpoints(
  segments: Segment2[],
  tolerance: number,
): Segment2[] {
  const endpoints: EndpointReference[] = segments.flatMap((segment, index) => {
    const axis = originalAxis(segment);

    return [
      { segmentIndex: index, endpoint: "start", point: segment.start, axis },
      { segmentIndex: index, endpoint: "end", point: segment.end, axis },
    ];
  });
  const clusters: EndpointCluster[] = [];
  const grid = new Map<string, Set<number>>();
  const cellSize = Math.max(tolerance, 1);

  for (const endpoint of endpoints) {
    const clusterIndex = findSnapClusterIndex(
      clusters,
      grid,
      endpoint,
      tolerance,
      cellSize,
    );

    if (clusterIndex !== null) {
      const cluster = clusters[clusterIndex];
      cluster.points.push(endpoint);
      cluster.canonical = recalculateCanonical(cluster.points);
      addClusterToGrid(grid, clusterIndex, cluster.canonical, cellSize);
      continue;
    }

    const nextClusterIndex = clusters.length;
    clusters.push({
      points: [endpoint],
      canonical: clonePoint(endpoint.point),
    });
    addClusterToGrid(grid, nextClusterIndex, endpoint.point, cellSize);
  }

  const snapped = segments.map(cloneSegment);

  for (const cluster of clusters) {
    if (cluster.points.length < 2) {
      continue;
    }

    for (const reference of cluster.points) {
      snapped[reference.segmentIndex][reference.endpoint] = clonePoint(
        cluster.canonical,
      );
    }
  }

  return snapped
    .map((segment, index) => {
      const axis = originalAxis(segments[index]);

      if (axis === "horizontal") {
        const y = Math.round((segment.start.y + segment.end.y) / 2);

        return {
          start: { x: segment.start.x, y },
          end: { x: segment.end.x, y },
        };
      }

      if (axis === "vertical") {
        const x = Math.round((segment.start.x + segment.end.x) / 2);

        return {
          start: { x, y: segment.start.y },
          end: { x, y: segment.end.y },
        };
      }

      return segment;
    })
    .filter((segment) => segmentLength(segment) >= MIN_SNAPPED_SEGMENT_LENGTH);
}
