export type Point2 = {
  x: number;
  y: number;
};

export type Segment2 = {
  start: Point2;
  end: Point2;
};

export type Wall = {
  id: string;
  segment: Segment2;
  thicknessMeters: number;
  exterior: boolean;
};

export type Opening = {
  id: string;
  wallId: Wall["id"];
  kind: "door" | "window";
  segment: Segment2;
  heightMeters: number;
  sillHeightMeters: number;
};

export type Plan = {
  width: number;
  height: number;
  scale: {
    pixelsPerMeter: number;
  };
  walls: Wall[];
  openings: Opening[];
};

export type WallMeshSpec = {
  wallId: Wall["id"];
  segment: Segment2;
  heightMeters: number;
  thicknessMeters: number;
  openings: Opening[];
};

export type FloorMeshSpec = {
  width: number;
  height: number;
  scale: Plan["scale"];
};

export type ModelSpec = {
  floor: FloorMeshSpec;
  walls: WallMeshSpec[];
};

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segmentLength(segment: Segment2): number {
  return distance(segment.start, segment.end);
}

export function midpoint(segment: Segment2): Point2 {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}
