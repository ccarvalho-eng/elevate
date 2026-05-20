import type { Plan } from "../domain/geometry";
import { midpoint, segmentLength } from "../domain/geometry";

const DEFAULT_PIXELS_PER_METER = 80;

type Vector3 = [number, number, number];

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
  const pixelsPerMeter = validPixelsPerMeter(plan.scale?.pixelsPerMeter);

  return {
    floor: {
      center: [
        plan.width / pixelsPerMeter / 2,
        0,
        plan.height / pixelsPerMeter / 2,
      ],
      size: [plan.width / pixelsPerMeter, 0, plan.height / pixelsPerMeter],
    },
    walls: plan.walls.map((wall) => buildWallMeshSpec(wall, pixelsPerMeter)),
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

function buildWallMeshSpec(
  wall: Plan["walls"][number],
  pixelsPerMeter: number,
): WallMeshSpec {
  const center = midpoint(wall.segment);

  return {
    wallId: wall.id,
    center: [
      center.x / pixelsPerMeter,
      wall.height / 2,
      center.y / pixelsPerMeter,
    ],
    size: [
      segmentLength(wall.segment) / pixelsPerMeter,
      wall.height,
      wall.thicknessMeters,
    ],
    rotationY: Math.atan2(
      wall.segment.end.y - wall.segment.start.y,
      wall.segment.end.x - wall.segment.start.x,
    ),
  };
}
