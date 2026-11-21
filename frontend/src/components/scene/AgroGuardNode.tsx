import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { CVResult, FrostPrediction } from "../../types";

interface Props {
  prediction: FrostPrediction;
  latestCv: CVResult | null;
  lastCvScanTs: number;
}

function createSolarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#162944";
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = "#5b9bd5";
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  for (let y = 0; y <= 160; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const IR_POINTS: [number, number, number][] = [
  [-0.14, 1.24, 0.04],
  [-1.35, 0.92, 0.25],
];

export const AgroGuardNode: React.FC<Props> = ({
  prediction,
  latestCv,
  lastCvScanTs,
}) => {
  const liveRef = useRef({ prediction, latestCv, lastCvScanTs });
  liveRef.current = { prediction, latestCv, lastCvScanTs };

  const statusLedMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const statusLightRef = useRef<THREE.PointLight>(null);
  const scanConeRef = useRef<THREE.Mesh>(null);
  const scanConeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringLedMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const solarTexture = useMemo(() => createSolarTexture(), []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const { prediction: p, latestCv: cv, lastCvScanTs: scanTs } = liveRef.current;

    const isCrit = p.frost_level === "critical" || cv?.severity === "critical";
    const isWarn = p.frost_level === "warning" || cv?.severity === "warning";
    const ledColor = isCrit ? 0xb92b27 : isWarn ? 0xb85a1e : 0x245c43;

    statusLedMatRef.current?.color.setHex(ledColor);
    if (statusLightRef.current) {
      statusLightRef.current.color.setHex(ledColor);
      statusLightRef.current.intensity = isCrit
        ? 0.6 + Math.abs(Math.sin(elapsed * 8)) * 1.3
        : 0.85;
    }

    const sinceScan = Date.now() / 1000 - scanTs;
    if (scanTs > 0 && sinceScan < 4.5) {
      const fade = Math.max(0, 1 - sinceScan / 4.5);
      if (scanConeMatRef.current) {
        scanConeMatRef.current.opacity = 0.28 * fade * (0.65 + 0.35 * Math.sin(elapsed * 14));
      }
      if (scanConeRef.current) {
        scanConeRef.current.rotation.y = Math.sin(elapsed * 4.5) * 0.45;
      }
      ringLedMatRef.current?.color.setHex(0xffffff);
    } else {
      if (scanConeMatRef.current) scanConeMatRef.current.opacity = 0;
      ringLedMatRef.current?.color.setHex(0x3a9a6c);
    }
  });

  return (
    <group position={[0.62, 0.14, 0.42]}>
      {/* Aluminum Mounting Mast */}
      <mesh position={[0, 0.725, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.038, 1.45, 10]} />
        <meshStandardMaterial color="#9aa3a0" metalness={0.7} roughness={0.34} />
      </mesh>

      {/* IP65 Enclosure */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[0.28, 0.34, 0.18]} />
        <meshStandardMaterial color="#f2eee4" roughness={0.38} metalness={0.08} />
      </mesh>

      {/* Botanical Green Faceplate */}
      <mesh position={[0, 1.41, 0.095]}>
        <boxGeometry args={[0.24, 0.06, 0.02]} />
        <meshStandardMaterial color="#245c43" emissive="#1b4632" emissiveIntensity={0.25} />
      </mesh>

      {/* Camera Lens & Ring LED */}
      <mesh position={[-0.15, 1.32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.042, 0.045, 0.05, 16]} />
        <meshStandardMaterial color="#181c1a" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[-0.175, 1.32, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.048, 0.008, 8, 24]} />
        <meshBasicMaterial ref={ringLedMatRef} color="#3a9a6c" />
      </mesh>

      {/* Volumetric Edge-CV Scan Cone */}
      <mesh
        ref={scanConeRef}
        position={[-1.18, 1.06, 0]}
        rotation={[0, 0, -Math.PI / 2 + 0.22]}
      >
        <coneGeometry args={[0.95, 2.2, 24, 1, true]} />
        <meshBasicMaterial
          ref={scanConeMatRef}
          color="#3a9a6c"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* MLX90614 Infrared Leaf Thermometer Laser */}
      <Line points={IR_POINTS} color="#d94f4b" transparent opacity={0.7} lineWidth={1.5} />
      <mesh position={IR_POINTS[1]}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshBasicMaterial color="#d94f4b" />
      </mesh>

      {/* Tilted Solar Panel */}
      <mesh position={[0, 1.62, 0]} rotation={[0.36, 0, 0]}>
        <boxGeometry args={[0.46, 0.025, 0.34]} />
        <meshStandardMaterial color="#9aa3a0" metalness={0.7} roughness={0.34} />
      </mesh>
      <mesh position={[0, 1.635, 0.005]} rotation={[-Math.PI / 2 + 0.36, 0, 0]}>
        <planeGeometry args={[0.42, 0.3]} />
        <meshStandardMaterial map={solarTexture} roughness={0.25} metalness={0.4} />
      </mesh>

      {/* Status Beacon LED */}
      <mesh position={[0.11, 1.52, 0.06]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial ref={statusLedMatRef} color="#245c43" />
      </mesh>
      <pointLight ref={statusLightRef} position={[0.11, 1.52, 0.06]} color="#245c43" intensity={0.85} distance={3.2} />
    </group>
  );
};
