export type Vector3Tuple = [number, number, number];

export type ModelBounds = {
  min: Vector3Tuple;
  max: Vector3Tuple;
};

export type CameraPresetName =
  | "roof-off"
  | "exterior"
  | "front"
  | "side"
  | "interior";

export type CameraPreset = {
  name: CameraPresetName;
  label: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
};

export const CAMERA_PRESET_NAMES: CameraPresetName[] = [
  "roof-off",
  "exterior",
  "front",
  "side",
  "interior",
];

const LABELS: Record<CameraPresetName, string> = {
  "roof-off": "Roof-off",
  exterior: "Exterior",
  front: "Front",
  side: "Side",
  interior: "Interior",
};

export function getCameraPreset(
  name: CameraPresetName,
  bounds: ModelBounds,
): CameraPreset {
  const normalized = normalizeBounds(bounds);
  const [centerX, centerY, centerZ] = centerOf(normalized);
  const [width, height, depth] = sizeOf(normalized);
  const span = Math.max(width, height, depth, 1);
  const target: Vector3Tuple = [centerX, centerY, centerZ];

  const positions: Record<CameraPresetName, Vector3Tuple> = {
    "roof-off": [centerX, normalized.max[1] + span * 1.35, centerZ],
    exterior: [
      normalized.max[0] + span * 1.2,
      centerY + span * 0.65,
      normalized.max[2] + span * 1.2,
    ],
    front: [centerX, centerY + span * 0.35, normalized.min[2] - span * 1.25],
    side: [normalized.max[0] + span * 1.25, centerY + span * 0.35, centerZ],
    interior: [centerX, Math.max(centerY, 1.4), centerZ - depth * 0.2],
  };

  return {
    name,
    label: LABELS[name],
    position: positions[name],
    target,
  };
}

function normalizeBounds(bounds: ModelBounds): ModelBounds {
  return {
    min: [
      Math.min(bounds.min[0], bounds.max[0]),
      Math.min(bounds.min[1], bounds.max[1]),
      Math.min(bounds.min[2], bounds.max[2]),
    ],
    max: [
      Math.max(bounds.min[0], bounds.max[0]),
      Math.max(bounds.min[1], bounds.max[1]),
      Math.max(bounds.min[2], bounds.max[2]),
    ],
  };
}

function centerOf(bounds: ModelBounds): Vector3Tuple {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

function sizeOf(bounds: ModelBounds): Vector3Tuple {
  return [
    Math.max(bounds.max[0] - bounds.min[0], 0),
    Math.max(bounds.max[1] - bounds.min[1], 0),
    Math.max(bounds.max[2] - bounds.min[2], 0),
  ];
}
