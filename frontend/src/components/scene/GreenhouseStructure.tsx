import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { ARCH_TOP, GH_L, GH_W } from "./types";

interface Props {
  leafTempC: number;
  ventOpen: boolean;
}

const WALKWAY_Z = [-3.0, -2.25, -1.5, -0.75, 0.0, 0.75, 1.5, 2.25, 3.0];
const VENT_Z = [-1.6, 1.6];

export const GreenhouseStructure: React.FC<Props> = ({ leafTempC, ventOpen }) => {
  const { scene: rawScene } = useGLTF("/models/greenhouse.glb");
  const liveRef = useRef({ leafTempC, ventOpen });
  liveRef.current = { leafTempC, ventOpen };

  const ventPivotRefs = useRef<(THREE.Group | null)[]>([null, null]);

  const { greenhouseObj, glassMaterials } = useMemo(() => {
    const cloned = rawScene.clone(true);
    const glassMats: THREE.MeshStandardMaterial[] = [];

    cloned.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const nextMats = mats.map((m) => {
        const mat = m.clone() as THREE.MeshStandardMaterial;
        const isGlass = mat.transparent || mat.opacity < 0.9 || mat.name.includes("glass");
        if (isGlass) {
          mat.transparent = true;
          mat.opacity = 0.2;
          mat.roughness = 0.16;
          mat.metalness = 0.05;
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
          glassMats.push(mat);
          obj.castShadow = false;
        } else {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
        return mat;
      });
      obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
    });

    return { greenhouseObj: cloned, glassMaterials: glassMats };
  }, [rawScene]);

  useFrame(() => {
    const { leafTempC: leaf, ventOpen: isOpen } = liveRef.current;

    const frostSeverity = Math.max(0, Math.min(1, (2.2 - leaf) / 3.8));
    for (const mat of glassMaterials) {
      mat.opacity = 0.18 + frostSeverity * 0.3;
      mat.color.setHex(frostSeverity > 0.25 ? 0xbae6fd : 0xf0f7fa);
    }

    const targetAngle = isOpen ? 0.56 : 0.0;
    for (const pivot of ventPivotRefs.current) {
      if (pivot) {
        pivot.rotation.z += (targetAngle - pivot.rotation.z) * 0.1;
      }
    }
  });

  return (
    <group>
      {/* Concrete Perimeter Foundation */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[GH_W + 0.4, 0.12, GH_L + 0.4]} />
        <meshStandardMaterial color="#474d4a" roughness={0.88} />
      </mesh>

      {/* Interior Stone Walkway */}
      {WALKWAY_Z.map((z) => (
        <mesh key={z} position={[0, 0.135, z]} receiveShadow>
          <boxGeometry args={[0.92, 0.03, 0.58]} />
          <meshStandardMaterial color="#6a6e66" roughness={0.92} />
        </mesh>
      ))}

      {/* Uploaded Arched Greenhouse 3D Model */}
      <primitive object={greenhouseObj} position={[0, 0.12, 0]} />

      {/* 2 Motorized Roof Vent Flaps */}
      {VENT_Z.map((vz, idx) => (
        <group
          key={vz}
          ref={(el) => {
            ventPivotRefs.current[idx] = el;
          }}
          position={[0.05, ARCH_TOP - 0.12, vz]}
        >
          <mesh position={[0.52, -0.04, 0]} rotation={[0, 0, -0.26]}>
            <boxGeometry args={[1.0, 0.035, 1.35]} />
            <meshPhysicalMaterial
              color="#9bc4d8"
              transparent
              opacity={0.4}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

useGLTF.preload("/models/greenhouse.glb");
