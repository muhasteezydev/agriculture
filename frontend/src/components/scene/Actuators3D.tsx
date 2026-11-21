import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GH_L } from "./types";

interface Props {
  sprinklerOn: boolean;
  heaterOn: boolean;
}

const NOZZLE_Z = [-2.55, -1.53, -0.51, 0.51, 1.53, 2.55];
const HEATER_Z = [-1.55, 1.55];
const MIST_COUNT = 720;

function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(225, 245, 255, 1)");
  grad.addColorStop(0.45, "rgba(125, 195, 232, 0.75)");
  grad.addColorStop(1, "rgba(30, 92, 132, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export const Actuators3D: React.FC<Props> = ({ sprinklerOn, heaterOn }) => {
  const liveRef = useRef({ sprinklerOn, heaterOn });
  liveRef.current = { sprinklerOn, heaterOn };

  const mistPointsRef = useRef<THREE.Points>(null);
  const mistGlowRef = useRef<THREE.PointLight>(null);
  const heaterRodMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([null, null]);
  const heaterLightRefs = useRef<(THREE.PointLight | null)[]>([null, null]);

  const { mistGeo, mistVel, mistNozzleIdx, mistTexture } = useMemo(() => {
    const positions = new Float32Array(MIST_COUNT * 3);
    const vel = new Float32Array(MIST_COUNT * 3);
    const nozzleIdx = new Uint8Array(MIST_COUNT);

    for (let i = 0; i < MIST_COUNT; i++) {
      const nIdx = i % NOZZLE_Z.length;
      nozzleIdx[i] = nIdx;
      const nz = NOZZLE_Z[nIdx];
      positions[i * 3] = (Math.random() - 0.5) * 0.08;
      positions[i * 3 + 1] = 3.12 - Math.random() * 2.5;
      positions[i * 3 + 2] = nz + (Math.random() - 0.5) * 0.08;

      const angle = Math.random() * Math.PI * 2;
      const spread = 0.5 + Math.random() * 1.35;
      vel[i * 3] = Math.cos(angle) * spread;
      vel[i * 3 + 1] = -(1.4 + Math.random() * 1.1);
      vel[i * 3 + 2] = Math.sin(angle) * spread * 0.68;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return {
      mistGeo: geo,
      mistVel: vel,
      mistNozzleIdx: nozzleIdx,
      mistTexture: createSoftParticleTexture(),
    };
  }, []);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const elapsed = clock.getElapsedTime();
    const { sprinklerOn: mist, heaterOn: heat } = liveRef.current;

    if (mistPointsRef.current) {
      mistPointsRef.current.visible = mist;
      if (mist) {
        const posAttr = mistGeo.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < MIST_COUNT; i++) {
          arr[i * 3] += mistVel[i * 3] * dt;
          arr[i * 3 + 1] += mistVel[i * 3 + 1] * dt;
          arr[i * 3 + 2] += mistVel[i * 3 + 2] * dt;
          if (arr[i * 3 + 1] < 0.45) {
            const nz = NOZZLE_Z[mistNozzleIdx[i]];
            arr[i * 3] = (Math.random() - 0.5) * 0.07;
            arr[i * 3 + 1] = 3.12;
            arr[i * 3 + 2] = nz + (Math.random() - 0.5) * 0.07;
          }
        }
        posAttr.needsUpdate = true;
      }
    }

    if (mistGlowRef.current) {
      mistGlowRef.current.intensity = mist ? 1.5 + Math.sin(elapsed * 5) * 0.2 : 0;
    }

    const targetEmissive = heat ? 3.8 : 0.0;
    for (const mat of heaterRodMatRefs.current) {
      if (mat) {
        mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.12;
      }
    }

    for (const light of heaterLightRefs.current) {
      if (light) {
        const targetIntensity = heat ? 4.0 + Math.sin(elapsed * 6) * 0.25 : 0;
        light.intensity += (targetIntensity - light.intensity) * 0.12;
      }
    }
  });

  return (
    <group>
      {/* Overhead Micro-Sprinkler Pipe & 6 Brass Nozzles */}
      <mesh position={[0, 3.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, GH_L - 0.9, 8]} />
        <meshStandardMaterial color="#68726e" metalness={0.7} roughness={0.35} />
      </mesh>
      {NOZZLE_Z.map((nz) => (
        <mesh key={nz} position={[0, 3.17, nz]}>
          <cylinderGeometry args={[0.025, 0.045, 0.12, 8]} />
          <meshStandardMaterial color="#b8732a" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* 720 Water-Mist Droplet Particles */}
      <points ref={mistPointsRef} geometry={mistGeo} visible={false}>
        <pointsMaterial
          size={0.19}
          map={mistTexture}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <pointLight ref={mistGlowRef} position={[0, 2.3, 0]} color="#5ba8d8" intensity={0} distance={10} />

      {/* 2 Suspended IR Greenhouse Heaters */}
      {HEATER_Z.map((hz, idx) => (
        <group key={hz} position={[0, 2.85, hz]}>
          <mesh>
            <boxGeometry args={[1.1, 0.12, 0.24]} />
            <meshStandardMaterial color="#272c2a" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 0.95, 10]} />
            <meshStandardMaterial
              ref={(el) => {
                heaterRodMatRefs.current[idx] = el;
              }}
              color="#451a03"
              emissive="#e05a1e"
              emissiveIntensity={0}
              roughness={0.3}
            />
          </mesh>
          <pointLight
            ref={(el) => {
              heaterLightRefs.current[idx] = el;
            }}
            position={[0, -0.2, 0]}
            color="#f07224"
            intensity={0}
            distance={9.5}
          />
        </group>
      ))}
    </group>
  );
};
