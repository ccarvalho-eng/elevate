import type { Plan } from "../domain/geometry";

export const simplePlan: Plan = {
  width: 640,
  height: 420,
  scale: {
    pixelsPerMeter: 80,
  },
  walls: [
    {
      id: "north",
      segment: {
        start: { x: 0, y: 0 },
        end: { x: 640, y: 0 },
      },
      thicknessMeters: 0.15,
      exterior: true,
    },
    {
      id: "east",
      segment: {
        start: { x: 640, y: 0 },
        end: { x: 640, y: 420 },
      },
      thicknessMeters: 0.15,
      exterior: true,
    },
    {
      id: "south",
      segment: {
        start: { x: 640, y: 420 },
        end: { x: 0, y: 420 },
      },
      thicknessMeters: 0.15,
      exterior: true,
    },
    {
      id: "west",
      segment: {
        start: { x: 0, y: 420 },
        end: { x: 0, y: 0 },
      },
      thicknessMeters: 0.15,
      exterior: true,
    },
    {
      id: "partition",
      segment: {
        start: { x: 320, y: 0 },
        end: { x: 320, y: 420 },
      },
      thicknessMeters: 0.1,
      exterior: false,
    },
  ],
  openings: [
    {
      id: "front-door",
      wallId: "south",
      kind: "door",
      segment: {
        start: { x: 360, y: 420 },
        end: { x: 280, y: 420 },
      },
      heightMeters: 2.1,
      sillHeightMeters: 0,
    },
  ],
};
