import type { Plan } from "../domain/geometry";
import { midpoint, segmentLength } from "../domain/geometry";

const DEFAULT_PIXELS_PER_METER = 80;
const MIN_REASONABLE_SHORT_FOOTPRINT_METERS = 4;
const TARGET_TINY_SHORT_FOOTPRINT_METERS = 6;
const MAX_REASONABLE_WALL_HEIGHT_METERS = 3.6;

type Vector3 = [number, number, number];

type PlanBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type FloorMeshSpec = {
  center: Vector3;
  size: Vector3;
};

export type WallMeshSpec = {
  wallId: string;
  center: Vector3;
  size: Vector3;
  rotationY: number;
};

export type ModelSpec = {
  floor: FloorMeshSpec;
  walls: WallMeshSpec[];
};

export function buildModelSpec(plan: Plan): ModelSpec {
  const bounds = planBounds(plan);
  const pixelsPerMeter = effectivePixelsPerMeter(plan, bounds);

  return {
    floor: {
      center: floorCenter(bounds, pixelsPerMeter),
      size: floorSize(bounds, pixelsPerMeter),
    },
    walls: plan.walls.map((wall) =>
      buildWallMeshSpec(wall, pixelsPerMeter, boundedWallHeight(wall.height)),
    ),
  };
}

function validPixelsPerMeter(pixelsPerMeter: number | undefined): number {
  if (pixelsPerMeter === undefined) {
    return DEFAULT_PIXELS_PER_METER;
  }

  return Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0
    ? pixelsPerMeter
    : DEFAULT_PIXELS_PER_METER;
}

function planBounds(plan: Plan): PlanBounds {
  if (plan.walls.length === 0) {
    return {
      minX: 0,
      maxX: plan.width,
      minY: 0,
      maxY: plan.height,
    };
  }

  return plan.walls.reduce<PlanBounds>(
    (bounds, wall) => ({
      minX: Math.min(bounds.minX, wall.segment.start.x, wall.segment.end.x),
      maxX: Math.max(bounds.maxX, wall.segment.start.x, wall.segment.end.x),
      minY: Math.min(bounds.minY, wall.segment.start.y, wall.segment.end.y),
      maxY: Math.max(bounds.maxY, wall.segment.start.y, wall.segment.end.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function boundsWidth(bounds: PlanBounds): number {
  return Math.max(bounds.maxX - bounds.minX, 0);
}

function boundsHeight(bounds: PlanBounds): number {
  return Math.max(bounds.maxY - bounds.minY, 0);
}

function effectivePixelsPerMeter(plan: Plan, bounds: PlanBounds): number {
  const pixelsPerMeter = validPixelsPerMeter(plan.scale?.pixelsPerMeter);
  const shortestFootprintPixels = Math.min(
    boundsWidth(bounds),
    boundsHeight(bounds),
  );

  if (shortestFootprintPixels <= 0) {
    return pixelsPerMeter;
  }

  const shortestFootprintMeters = shortestFootprintPixels / pixelsPerMeter;

  if (shortestFootprintMeters >= MIN_REASONABLE_SHORT_FOOTPRINT_METERS) {
    return pixelsPerMeter;
  }

  return shortestFootprintPixels / TARGET_TINY_SHORT_FOOTPRINT_METERS;
}

function floorCenter(bounds: PlanBounds, pixelsPerMeter: number): Vector3 {
  return [
    (bounds.minX + bounds.maxX) / pixelsPerMeter / 2,
    0,
    (bounds.minY + bounds.maxY) / pixelsPerMeter / 2,
  ];
}

function floorSize(bounds: PlanBounds, pixelsPerMeter: number): Vector3 {
  return [
    boundsWidth(bounds) / pixelsPerMeter,
    0,
    boundsHeight(bounds) / pixelsPerMeter,
  ];
}

function boundedWallHeight(height: number): number {
  if (!Number.isFinite(height) || height <= 0) {
    return MAX_REASONABLE_WALL_HEIGHT_METERS;
  }

  return Math.min(height, MAX_REASONABLE_WALL_HEIGHT_METERS);
}

function buildWallMeshSpec(
  wall: Plan["walls"][number],
  pixelsPerMeter: number,
  wallHeight: number,
): WallMeshSpec {
  const center = midpoint(wall.segment);

  return {
    wallId: wall.id,
    center: [
      center.x / pixelsPerMeter,
      wallHeight / 2,
      center.y / pixelsPerMeter,
    ],
    size: [
      segmentLength(wall.segment) / pixelsPerMeter,
      wallHeight,
      wall.thicknessMeters,
    ],
    rotationY: Math.atan2(
      wall.segment.end.y - wall.segment.start.y,
      wall.segment.end.x - wall.segment.start.x,
    ),
  };
}
