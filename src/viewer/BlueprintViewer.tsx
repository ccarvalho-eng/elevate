import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type { ModelSpec } from "../model/modelBuilder";
import {
  CAMERA_PRESET_NAMES,
  getCameraPreset,
  type CameraPresetName,
} from "./cameraPresets";
import { getModelBounds } from "./modelBounds";

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
