import React, { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Eye, Cpu, ShieldAlert } from "lucide-react";
import { ActuatorState, CVResult, FrostPrediction, Lang, SensorReading } from "../types";
import { CAMERA_PRESETS, CameraPreset } from "./scene/types";
import { EnvironmentRig } from "./scene/EnvironmentRig";
import { GreenhouseStructure } from "./scene/GreenhouseStructure";
import { CropBeds } from "./scene/CropBeds";
import { AgroGuardNode } from "./scene/AgroGuardNode";
import { Actuators3D } from "./scene/Actuators3D";

interface Props {
  sensors: SensorReading;
  prediction: FrostPrediction;
  actuators: ActuatorState;
  latestCv: CVResult | null;
  lastCvScanTs: number;
  lang: Lang;
}

interface CameraRigProps {
  preset: CameraPreset;
  presetVersion: number;
}

const CameraRig: React.FC<CameraRigProps> = ({ preset, presetVersion }) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.hero.pos));
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.hero.target));
  const lerping = useRef(false);

  useEffect(() => {
    targetPos.current.set(...CAMERA_PRESETS[preset].pos);
    targetLook.current.set(...CAMERA_PRESETS[preset].target);
    lerping.current = presetVersion > 0;
  }, [preset, presetVersion]);

  useFrame(() => {
    if (!lerping.current || !controlsRef.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    controlsRef.current.target.lerp(targetLook.current, 0.08);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.06) {
      lerping.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={CAMERA_PRESETS.hero.target}
      enableDamping
      dampingFactor={0.06}
      minDistance={1.6}
      maxDistance={24}
      maxPolarAngle={Math.PI / 2 - 0.03}
      onStart={() => {
        lerping.current = false;
      }}
    />
  );
};

export const Greenhouse3D: React.FC<Props> = ({
  sensors,
  prediction,
  actuators,
  latestCv,
  lastCvScanTs,
  lang,
}) => {
  const [preset, setPreset] = useState<CameraPreset>("hero");
  const [presetVersion, setPresetVersion] = useState(0);

  const selectPreset = (p: CameraPreset) => {
    setPreset(p);
    setPresetVersion((v) => v + 1);
  };

  const hoursFormatted = `${String(Math.floor(sensors.sim_hour)).padStart(2, "0")}:${String(
    Math.floor((sensors.sim_hour % 1) * 60)
  ).padStart(2, "0")}`;

  return (
    <div className="liquid-glass relative h-[395px] w-full overflow-hidden rounded-[22px] xl:h-[435px]">
      {/* React Three Fiber Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_PRESETS.hero.pos, fov: 44, near: 0.1, far: 140 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      >
        <EnvironmentRig simHour={sensors.sim_hour} leafTempC={sensors.leaf_temp_c} />
        <CameraRig preset={preset} presetVersion={presetVersion} />

        <group>
          <Suspense fallback={null}>
            <GreenhouseStructure
              leafTempC={sensors.leaf_temp_c}
              ventOpen={actuators.vent_open}
            />
            <CropBeds
              leafTempC={sensors.leaf_temp_c}
              ventOpen={actuators.vent_open}
              sprinklerOn={actuators.sprinkler_on}
              latestCv={latestCv}
            />
          </Suspense>
          <AgroGuardNode
            prediction={prediction}
            latestCv={latestCv}
            lastCvScanTs={lastCvScanTs}
          />
          <Actuators3D
            sprinklerOn={actuators.sprinkler_on}
            heaterOn={actuators.heater_on}
          />
        </group>
      </Canvas>

      {/* Top-Right Glass Simulation Clock & Fail-Safe Pill */}
      <div className="pointer-events-none absolute top-3.5 right-3.5 flex flex-col items-end gap-1.5">
        <div className="liquid-pill flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 rounded-full bg-[#B5F043]" />
          <span className="font-mono-num font-medium">{hoursFormatted}</span>
        </div>

        {actuators.failsafe_active && (
          <div
            role="alert"
            className="flex items-center gap-1.5 rounded-full border border-[#FF6B6B]/60 bg-[#B92B27]/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lang === "ru" ? "Аварийная защита активна" : "Авариялык коргоо иштөөдө"}</span>
          </div>
        )}
      </div>

      {/* Bottom-Left Liquid Glass Camera Presets */}
      <div
        role="group"
        aria-label={lang === "ru" ? "Ракурсы камеры 3D-теплицы" : "3D камера ракурстары"}
        className="absolute bottom-3.5 left-3.5 flex flex-wrap items-center gap-1.5"
      >
        {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={preset === key}
            onClick={() => selectPreset(key)}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              preset === key
                ? "bg-white text-[#142014] shadow-md"
                : "liquid-pill text-white/95 hover:text-white"
            }`}
          >
            {key === "node" ? (
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {lang === "ru" ? CAMERA_PRESETS[key].label_ru : CAMERA_PRESETS[key].label_kg}
          </button>
        ))}
      </div>
    </div>
  );
};
