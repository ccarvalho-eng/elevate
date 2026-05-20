import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type { ModelSpec } from "../model/modelBuilder";
import {
  CAMERA_PRESET_NAMES,
  getCameraPreset,
  type CameraPresetName,
  type ModelBounds,
} from "./cameraPresets";

type BlueprintViewerProps = {
  model: ModelSpec;
};

export function BlueprintViewer({ model }: BlueprintViewerProps) {
  const [selectedPreset, setSelectedPreset] =
    useState<CameraPresetName>("roof-off");
  const bounds = useMemo(() => getModelBounds(model), [model]);
  const preset = getCameraPreset(selectedPreset, bounds);

  return (
    <section className="viewer" aria-label="3D perspective viewer">
      <div className="viewer-toolbar" aria-label="Camera presets">
        {CAMERA_PRESET_NAMES.map((presetName) => {
          const option = getCameraPreset(presetName, bounds);

          return (
            <button
              className={presetName === selectedPreset ? "active" : ""}
              key={presetName}
              type="button"
              onClick={() => setSelectedPreset(presetName)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Canvas className="viewer-canvas" shadows dpr={[1, 1.75]}>
        <color attach="background" args={["#eef2f5"]} />
        <PerspectiveCamera
          key={selectedPreset}
          makeDefault
          position={preset.position}
          fov={48}
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={0.65} />
        <directionalLight
          castShadow
          intensity={1.15}
          position={[12, 16, 10]}
          shadow-mapSize={[1024, 1024]}
        />
        <ModelScene model={model} />
        <OrbitControls
          key={`${selectedPreset}-controls`}
          makeDefault
          target={preset.target}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.48}
        />
      </Canvas>
    </section>
  );
}

function ModelScene({ model }: { model: ModelSpec }) {
  return (
    <group>
      <mesh position={model.floor.center} receiveShadow>
        <boxGeometry args={model.floor.size} />
        <meshStandardMaterial color="#dfe5eb" roughness={0.84} />
      </mesh>

      {model.walls.map((wall) => (
        <mesh
          castShadow
          key={wall.wallId}
          position={wall.center}
          rotation={[0, -wall.rotationY, 0]}
        >
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#fbfcfd" roughness={0.68} />
        </mesh>
      ))}

      <gridHelper
        args={[
          Math.max(model.floor.size[0], model.floor.size[2], 1),
          12,
          "#b8c2cc",
          "#d4dce4",
        ]}
        position={model.floor.center}
      />
    </group>
  );
}

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
