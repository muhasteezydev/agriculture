import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useFBX, useGLTF, useTexture } from "@react-three/drei";
import { CVResult } from "../../types";
import { getInfectedSectorId, getSectorCenter, SECTORS } from "./types";

interface Props {
  leafTempC: number;
  ventOpen: boolean;
  sprinklerOn: boolean;
  latestCv: CVResult | null;
}

interface PlantInstance {
  id: string;
  sectorId: string;
  crop: "tomato" | "strawberry";
  x: number;
  z: number;
  rotY: number;
  scale: number;
  phase: number;
  object: THREE.Object3D;
  materials: THREE.MeshStandardMaterial[];
}

const WHITE_BASE = new THREE.Color(0xffffff);
const FROST_TINT = new THREE.Color(0xa8d5f7);
const DISEASE_BLIGHT = new THREE.Color(0xc29e57);
const DISEASE_MILDEW = new THREE.Color(0xcad9c5);

export const CropBeds: React.FC<Props> = ({
  leafTempC,
  ventOpen,
  sprinklerOn,
  latestCv,
}) => {
  const { scene: tomatoRaw } = useGLTF("/models/tomato-plant.glb");
  const strawberryRaw = useFBX("/models/strawberry/strawberry.fbx");
  const [strawLeafTex, strawFlowerTex, strawFruitLeafTex] = useTexture([
    "/models/strawberry/leave.png",
    "/models/strawberry/flower.png",
    "/models/strawberry/straw_leave.png",
  ]);

  const liveRef = useRef({ leafTempC, ventOpen, sprinklerOn, latestCv });
  liveRef.current = { leafTempC, ventOpen, sprinklerOn, latestCv };

  const plantGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const anomalyGroupRef = useRef<THREE.Group>(null);
  const anomalyRingRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Normalize strawberry FBX to ~0.58m tall resting cleanly on Y=0 with verified textures
  const strawberryTemplate = useMemo(() => {
    strawLeafTex.colorSpace = THREE.SRGBColorSpace;
    strawFlowerTex.colorSpace = THREE.SRGBColorSpace;
    strawFruitLeafTex.colorSpace = THREE.SRGBColorSpace;

    const root = strawberryRaw.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.y, 0.001);
    const normScale = 0.42 / maxDim;

    const wrapper = new THREE.Group();
    root.scale.setScalar(normScale);
    root.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
    wrapper.add(root);

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const nextMats = mats.map((orig) => {
        const name = `${obj.name} ${orig?.name ?? ""}`.toLowerCase();
        const isFlower = name.includes("flower") || name.includes("petal") || name.includes("blossom");
        const isBerry = name.includes("straw") || name.includes("berry") || name.includes("fruit");
        const isLeaf = name.includes("leaf") || name.includes("leave") || name.includes("stem");

        const existingMap = (orig as THREE.MeshStandardMaterial | undefined)?.map ?? null;
        let map = existingMap;
        if (!map) {
          if (isFlower) map = strawFlowerTex;
          else if (isBerry) map = strawFruitLeafTex;
          else if (isLeaf) map = strawLeafTex;
        }

        const std = new THREE.MeshStandardMaterial({
          color: isBerry && !map ? new THREE.Color(0xc92a2a) : new THREE.Color(0xffffff),
          map,
          alphaTest: map ? 0.42 : 0,
          roughness: isBerry ? 0.35 : 0.68,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        return std;
      });
      obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
    });

    return wrapper;
  }, [strawberryRaw, strawLeafTex, strawFlowerTex, strawFruitLeafTex]);

  // Build planted instances across Sectors A & B (Tomatoes) and C & D (Strawberries)
  const instances = useMemo<PlantInstance[]>(() => {
    const list: PlantInstance[] = [];
    let idx = 0;

    for (const sec of SECTORS) {
      if (sec.crop === "tomato") {
        // 6 real 3D tomato plants per bed (3 rows x 2 cols)
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 2; col++) {
            const clone = tomatoRaw.clone(true);
            const mats: THREE.MeshStandardMaterial[] = [];
            clone.traverse((obj) => {
              if (!(obj instanceof THREE.Mesh)) return;
              obj.castShadow = true;
              obj.receiveShadow = true;
              const arr = Array.isArray(obj.material) ? obj.material : [obj.material];
              const clonedMats = arr.map((m) => {
                const nm = (m.clone() as THREE.MeshStandardMaterial);
                nm.roughness = 0.65;
                nm.side = THREE.DoubleSide;
                mats.push(nm);
                return nm;
              });
              obj.material = Array.isArray(obj.material) ? clonedMats : clonedMats[0];
            });

            list.push({
              id: `${sec.id}-t-${row}-${col}`,
              sectorId: sec.id,
              crop: "tomato",
              x: sec.x + (col === 0 ? -0.34 : 0.34),
              z: sec.z - 0.92 + row * 0.92,
              rotY: ((idx * 1.37) % (Math.PI * 2)),
              scale: 0.92 + (idx % 3) * 0.08,
              phase: (idx * 1.13) % (Math.PI * 2),
              object: clone,
              materials: mats,
            });
            idx++;
          }
        }
      } else {
        // 8 real 3D strawberry plants per bed (4 rows x 2 cols)
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            const clone = strawberryTemplate.clone(true);
            const mats: THREE.MeshStandardMaterial[] = [];
            clone.traverse((obj) => {
              if (!(obj instanceof THREE.Mesh)) return;
              const arr = Array.isArray(obj.material) ? obj.material : [obj.material];
              const clonedMats = arr.map((m) => {
                const nm = m.clone() as THREE.MeshStandardMaterial;
                mats.push(nm);
                return nm;
              });
              obj.material = Array.isArray(obj.material) ? clonedMats : clonedMats[0];
            });

            list.push({
              id: `${sec.id}-s-${row}-${col}`,
              sectorId: sec.id,
              crop: "strawberry",
              x: sec.x + (col === 0 ? -0.27 : 0.27),
              z: sec.z - 0.96 + row * 0.64,
              rotY: ((idx * 1.71) % (Math.PI * 2)),
              scale: 0.94 + (idx % 3) * 0.07,
              phase: (idx * 0.97) % (Math.PI * 2),
              object: clone,
              materials: mats,
            });
            idx++;
          }
        }
      }
    }

    return list;
  }, [tomatoRaw, strawberryTemplate]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const { leafTempC: leaf, ventOpen: vent, sprinklerOn: mist, latestCv: cv } = liveRef.current;

    const frostSeverity = Math.max(0, Math.min(1, (2.2 - leaf) / 3.8));
    const swayAmp = vent || mist ? 0.036 : 0.012;
    const infectedSec = getInfectedSectorId(cv);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const grp = plantGroupRefs.current[i];
      if (grp) {
        grp.rotation.z = Math.sin(elapsed * 2.0 + inst.phase) * swayAmp;
      }

      const isInfected = infectedSec !== null && inst.sectorId === infectedSec;
      for (const mat of inst.materials) {
        if (isInfected) {
          mat.color.copy(
            cv?.disease_id === "powdery_mildew" ? DISEASE_MILDEW : DISEASE_BLIGHT
          );
        } else {
          mat.color.copy(WHITE_BASE).lerp(FROST_TINT, frostSeverity * 0.45);
        }
      }
    }

    const secTarget = getSectorCenter(cv);
    if (anomalyGroupRef.current) {
      if (secTarget) {
        anomalyGroupRef.current.visible = true;
        anomalyGroupRef.current.position.set(secTarget.x, 0, secTarget.z);
        ringMatRef.current?.color.setHex(secTarget.color);
        beamMatRef.current?.color.setHex(secTarget.color);
        const pulse = 1 + Math.sin(elapsed * 5) * 0.1;
        anomalyRingRef.current?.scale.set(pulse, pulse, 1);
        if (beamMatRef.current) {
          beamMatRef.current.opacity = 0.12 + Math.abs(Math.sin(elapsed * 4)) * 0.12;
        }
      } else {
        anomalyGroupRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      {/* 4 Raised Timber Crop Beds sized to fit inside greenhouse.glb */}
      {SECTORS.map((sec) => (
        <group key={sec.id}>
          <mesh position={[sec.x, 0.28, sec.z]} castShadow receiveShadow>
            <boxGeometry args={[1.42, 0.32, 2.85]} />
            <meshStandardMaterial color="#6e4a2b" roughness={0.88} />
          </mesh>
          <mesh position={[sec.x, 0.42, sec.z]} receiveShadow>
            <boxGeometry args={[1.3, 0.08, 2.72]} />
            <meshStandardMaterial color="#2a1e16" roughness={0.98} />
          </mesh>
        </group>
      ))}

      {/* Real 3D Tomato & Strawberry Plants */}
      {instances.map((inst, idx) => (
        <group
          key={inst.id}
          ref={(el) => {
            plantGroupRefs.current[idx] = el;
          }}
          position={[inst.x, 0.45, inst.z]}
          rotation={[0, inst.rotY, 0]}
          scale={inst.scale}
        >
          <primitive object={inst.object} />
        </group>
      ))}

      {/* Yellow Sticky Pest Trap in Sector D */}
      <group>
        <mesh position={[0.92, 0.96, 1.5]}>
          <cylinderGeometry args={[0.012, 0.012, 1.25, 6]} />
          <meshStandardMaterial color="#9aa3a0" metalness={0.7} roughness={0.34} />
        </mesh>
        <mesh position={[0.92, 1.48, 1.5]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.22, 0.3, 0.015]} />
          <meshStandardMaterial
            color="#e5b822"
            roughness={0.45}
            emissive="#6b4e0b"
            emissiveIntensity={0.12}
          />
        </mesh>
      </group>

      {/* Disease Sector Indicator Beacon */}
      <group ref={anomalyGroupRef} visible={false}>
        <mesh ref={anomalyRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.52, 0]}>
          <ringGeometry args={[0.68, 0.84, 32]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color="#b92b27"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.72, 0.8, 1.4, 24, 1, true]} />
          <meshBasicMaterial
            ref={beamMatRef}
            color="#b92b27"
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
};

useGLTF.preload("/models/tomato-plant.glb");
