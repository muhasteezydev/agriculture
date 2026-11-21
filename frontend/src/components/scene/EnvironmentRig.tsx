import React, { Component, Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";

interface Props {
  simHour: number;
  leafTempC: number;
}

class EnvErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const DAY_SKY = new THREE.Color(0x7fb3d5);
const SUNSET_SKY = new THREE.Color(0x4b3556);
const NIGHT_SKY = new THREE.Color(0x0f1926);
const GROUND_WARM = new THREE.Color(0x28382c);
const GROUND_FROST = new THREE.Color(0x3a5063);

export const EnvironmentRig: React.FC<Props> = ({ simHour, leafTempC }) => {
  const { scene } = useThree();
  const liveRef = useRef({ simHour, leafTempC });
  liveRef.current = { simHour, leafTempC };

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const starMatRef = useRef<THREE.PointsMaterial>(null);
  const groundMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const skyColor = useMemo(() => new THREE.Color(0x0f1926), []);

  const starGeo = useMemo(() => {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = ((i * 137.508) % 360) * (Math.PI / 180);
      const phi = ((i * 29.3) % 100) / 100 * Math.PI * 0.44;
      const rad = 54 + (i % 7) * 2.1;
      positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = rad * Math.cos(phi) + 4;
      positions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const peaks = useMemo(() => {
    const list: { x: number; y: number; z: number; h: number; r: number; rotY: number }[] = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const dist = 34 + (i % 3) * 4.5;
      const h = 6.5 + ((i * 7) % 9) * 1.1;
      const r = 6.2 + (i % 4) * 1.6;
      list.push({
        x: Math.cos(ang) * dist,
        y: h / 2 - 0.5,
        z: Math.sin(ang) * dist,
        h,
        r,
        rotY: i * 0.7,
      });
    }
    return list;
  }, []);

  useFrame(() => {
    const { simHour: h, leafTempC: leaf } = liveRef.current;

    let daylight = 0;
    if (h >= 6 && h <= 19) {
      daylight = Math.sin(((h - 6) / 13) * Math.PI);
    }

    if (daylight > 0.35) {
      skyColor.copy(SUNSET_SKY).lerp(DAY_SKY, (daylight - 0.35) / 0.65);
    } else {
      skyColor.copy(NIGHT_SKY).lerp(SUNSET_SKY, daylight / 0.35);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(skyColor);
    } else {
      scene.background = skyColor.clone();
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(skyColor);
    }

    if (starMatRef.current) {
      starMatRef.current.opacity = Math.max(0, 0.88 - daylight * 1.45);
    }

    if (sunRef.current) {
      sunRef.current.intensity = 0.45 + daylight * 1.55;
      sunRef.current.color.setHex(
        daylight < 0.25 ? 0x9ec5e8 : daylight < 0.55 ? 0xf3be8a : 0xfff6e5
      );
      const sunAngle = ((h - 6) / 12) * Math.PI;
      sunRef.current.position.set(
        Math.cos(sunAngle) * 16,
        Math.max(4, Math.sin(sunAngle) * 18),
        9
      );
    }

    if (hemiRef.current) {
      hemiRef.current.intensity = 0.35 + daylight * 0.5;
    }

    if (groundMatRef.current) {
      const frostSeverity = Math.max(0, Math.min(1, (2.2 - leaf) / 3.8));
      groundMatRef.current.color.copy(GROUND_WARM).lerp(GROUND_FROST, frostSeverity * 0.65);
    }
  });

  return (
    <>
      <color attach="background" args={["#0f1926"]} />
      <fogExp2 attach="fog" args={["#0f1926", 0.015]} />

      {/* Base lighting per R3F rules */}
      <ambientLight intensity={0.5} />
      <hemisphereLight ref={hemiRef} args={["#b4d4eb", "#243028", 0.55]} />
      <directionalLight
        ref={sunRef}
        position={[12, 16, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={45}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <pointLight position={[0, 3.0, 0]} color="#c8dff2" intensity={0.45} distance={14} />

      <EnvErrorBoundary>
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.35} />
        </Suspense>
      </EnvErrorBoundary>

      {/* Night Starfield */}
      <points geometry={starGeo}>
        <pointsMaterial
          ref={starMatRef}
          color="#e2e8f0"
          size={0.32}
          transparent
          opacity={0.7}
        />
      </points>

      {/* Valley Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[56, 48]} />
        <meshStandardMaterial
          ref={groundMatRef}
          color="#28382c"
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>

      {/* Tian Shan Mountain Ring */}
      <group>
        {peaks.map((pk, idx) => (
          <group key={idx}>
            <mesh position={[pk.x, pk.y, pk.z]} rotation={[0, pk.rotY, 0]}>
              <coneGeometry args={[pk.r, pk.h, 5]} />
              <meshStandardMaterial color="#27323d" roughness={0.92} flatShading />
            </mesh>
            <mesh
              position={[pk.x, pk.h - (pk.h * 0.35) / 2 - 0.45, pk.z]}
              rotation={[0, pk.rotY, 0]}
            >
              <coneGeometry args={[pk.r * 0.36, pk.h * 0.35, 5]} />
              <meshStandardMaterial color="#dfd9cc" roughness={0.72} flatShading />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
};
