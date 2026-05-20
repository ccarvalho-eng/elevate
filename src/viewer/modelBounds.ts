import type { ModelSpec } from "../model/modelBuilder";
import type { ModelBounds } from "./cameraPresets";

export function getModelBounds(model: ModelSpec): ModelBounds {
  const floorHalfWidth = model.floor.size[0] / 2;
  const floorHalfDepth = model.floor.size[2] / 2;

  const initial: ModelBounds = {
    min: [
      model.floor.center[0] - floorHalfWidth,
      0,
      model.floor.center[2] - floorHalfDepth,
    ],
    max: [
      model.floor.center[0] + floorHalfWidth,
      Math.max(...model.walls.map((wall) => wall.size[1]), 1),
      model.floor.center[2] + floorHalfDepth,
    ],
  };

  return model.walls.reduce(
    (bounds, wall) => expandBounds(bounds, wall),
    initial,
  );
}

function expandBounds(
  bounds: ModelBounds,
  wall: ModelSpec["walls"][number],
): ModelBounds {
  const halfLength = wall.size[0] / 2;
  const halfThickness = wall.size[2] / 2;
  const cos = Math.abs(Math.cos(wall.rotationY));
  const sin = Math.abs(Math.sin(wall.rotationY));
  const extentX = halfLength * cos + halfThickness * sin;
  const extentZ = halfLength * sin + halfThickness * cos;

  return {
    min: [
      Math.min(bounds.min[0], wall.center[0] - extentX),
      Math.min(bounds.min[1], wall.center[1] - wall.size[1] / 2),
      Math.min(bounds.min[2], wall.center[2] - extentZ),
    ],
    max: [
      Math.max(bounds.max[0], wall.center[0] + extentX),
      Math.max(bounds.max[1], wall.center[1] + wall.size[1] / 2),
      Math.max(bounds.max[2], wall.center[2] + extentZ),
    ],
  };
}
