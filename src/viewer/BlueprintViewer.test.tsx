import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildModelSpec, type ModelSpec } from "../model/modelBuilder";
import { simplePlan } from "../fixtures/simplePlan";
import { BlueprintViewer } from "./BlueprintViewer";
import { getModelBounds } from "./modelBounds";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="canvas" />,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: ({ position }: { position: [number, number, number] }) => (
    <div data-position={position.join(",")} data-testid="camera" />
  ),
}));

describe("BlueprintViewer", () => {
  it("renders camera preset buttons and marks the selected preset", () => {
    render(<BlueprintViewer model={buildModelSpec(simplePlan)} />);

    const roofOff = screen.getByRole("button", { name: "Roof-off" });
    expect(roofOff).toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "Exterior" }));

    expect(screen.getByRole("button", { name: "Exterior" })).toHaveClass(
      "active",
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("calculates rotated wall bounds without over-expanding both axes", () => {
    const model: ModelSpec = {
      floor: {
        center: [5, 0, 5],
        size: [0, 0, 0],
      },
      walls: [
        {
          wallId: "horizontal",
          center: [5, 1, 5],
          size: [4, 2, 0.5],
          rotationY: 0,
        },
      ],
    };

    const bounds = getModelBounds(model);

    expect(bounds.min[0]).toBeCloseTo(3);
    expect(bounds.max[0]).toBeCloseTo(7);
    expect(bounds.min[2]).toBeCloseTo(4.75);
    expect(bounds.max[2]).toBeCloseTo(5.25);
  });

  it("uses wall rotation when calculating vertical wall bounds", () => {
    const model: ModelSpec = {
      floor: {
        center: [2, 0, 4],
        size: [0, 0, 0],
      },
      walls: [
        {
          wallId: "vertical",
          center: [2, 1, 4],
          size: [6, 2, 0.4],
          rotationY: Math.PI / 2,
        },
      ],
    };

    const bounds = getModelBounds(model);

    expect(bounds.min[0]).toBeCloseTo(1.8);
    expect(bounds.max[0]).toBeCloseTo(2.2);
    expect(bounds.min[2]).toBeCloseTo(1);
    expect(bounds.max[2]).toBeCloseTo(7);
  });
});
