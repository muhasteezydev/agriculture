import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Eye, Droplets, Flame, Wind, Cpu, Thermometer, Snowflake, Radio } from "lucide-react";
import { ActuatorState, CVResult, FrostPrediction, Lang, SensorReading } from "../types";

interface Props {
  sensors: SensorReading;
  prediction: FrostPrediction;
  actuators: ActuatorState;
  latestCv: CVResult | null;
  lastCvScanTs: number;
  lang: Lang;
}

type CameraPreset = "hero" | "inside" | "node" | "top";

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; label_ru: string; label_kg: string }
> = {
  hero: {
    pos: [9.6, 5.4, 9.2],
    target: [0, 1.35, 0],
    label_ru: "Общий вид",
    label_kg: "Жалпы көрүнүш",
  },
  inside: {
    pos: [0.0, 1.85, 5.6],
    target: [0, 1.1, -1.5],
    label_ru: "Внутри теплицы",
    label_kg: "Күнөскана ичи",
  },
  node: {
    pos: [2.6, 2.05, 2.55],
    target: [0.65, 1.45, 0.45],
    label_ru: "Маяк AgroGuard",
    label_kg: "AgroGuard маягы",
  },
  top: {
    pos: [0.2, 11.8, 5.2],
    target: [0, 0.8, 0],
    label_ru: "Сверху (сектора)",
    label_kg: "Үстүнөн (секторлор)",
  },
};

// Map affected CV sector string to 3D bed coordinates (4 sectors A, B, C, D)
function getSectorCenter(cv: CVResult | null): { x: number; z: number; color: number } | null {
  if (!cv || cv.disease_id === "healthy") return null;
  if (cv.disease_id === "powdery_mildew") return { x: -1.65, z: -2.15, color: 0xf59e0b }; // Sector A
  if (cv.disease_id === "late_blight") return { x: -1.65, z: 2.05, color: 0xef4444 }; // Sector B
  if (cv.disease_id === "scab_rust") return { x: 1.65, z: -2.15, color: 0xf97316 }; // Sector C
  if (cv.disease_id === "sticky_trap_pests") return { x: 1.65, z: 2.05, color: 0xe11d48 }; // Sector D
  return null;
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(220, 248, 255, 1)");
  grad.addColorStop(0.4, "rgba(125, 211, 252, 0.75)");
  grad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createSolarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0F2654";
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = "#38BDF8";
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

export const Greenhouse3D: React.FC<Props> = ({
  sensors,
  prediction,
  actuators,
  latestCv,
  lastCvScanTs,
  lang,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [preset, setPreset] = useState<CameraPreset>("hero");

  // Live state ref read inside requestAnimationFrame loop (zero scene rebuilds!)
  const liveRef = useRef({
    sensors,
    prediction,
    actuators,
    latestCv,
    lastCvScanTs,
    targetCamPos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
    targetControls: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
    camLerping: false,
  });

  useEffect(() => {
    liveRef.current.sensors = sensors;
    liveRef.current.prediction = prediction;
    liveRef.current.actuators = actuators;
    liveRef.current.latestCv = latestCv;
    liveRef.current.lastCvScanTs = lastCvScanTs;
  }, [sensors, prediction, actuators, latestCv, lastCvScanTs]);

  const selectPreset = (p: CameraPreset) => {
    setPreset(p);
    liveRef.current.targetCamPos.set(...CAMERA_PRESETS[p].pos);
    liveRef.current.targetControls.set(...CAMERA_PRESETS[p].target);
    liveRef.current.camLerping = true;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1528);
    scene.fog = new THREE.FogExp2(0x0b1528, 0.017);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 140);
    camera.position.set(...CAMERA_PRESETS.hero.pos);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(...CAMERA_PRESETS.hero.target);
    controls.minDistance = 1.6;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.addEventListener("start", () => {
      liveRef.current.camLerping = false;
    });

    // ===================== LIGHTING =====================
    const hemiLight = new THREE.HemisphereLight(0x8ec5ff, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sunLight.position.set(12, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 45;
    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;
    scene.add(sunLight);

    // Subtle interior fill light so plants remain richly visible at night
    const interiorFill = new THREE.PointLight(0x93c5fd, 0.5, 14);
    interiorFill.position.set(0, 3.0, 0);
    scene.add(interiorFill);

    // ===================== SKY STARFIELD =====================
    const starCount = 460;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44;
      const rad = 54 + Math.random() * 14;
      starPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = rad * Math.cos(phi) + 4;
      starPositions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ===================== KYRGYZ VALLEY TERRAIN & TIAN SHAN PEAKS =====================
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e2c23,
      roughness: 0.95,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(56, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Distant Tian Shan mountain ring
    const mountainGroup = new THREE.Group();
    const peakCount = 26;
    for (let i = 0; i < peakCount; i++) {
      const ang = (i / peakCount) * Math.PI * 2;
      const dist = 34 + (i % 3) * 4.5;
      const h = 6.5 + ((i * 7) % 9) * 1.1;
      const r = 6.2 + (i % 4) * 1.6;
      const peakGeo = new THREE.ConeGeometry(r, h, 5);
      const peakMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.92,
        flatShading: true,
      });
      const peak = new THREE.Mesh(peakGeo, peakMat);
      peak.position.set(Math.cos(ang) * dist, h / 2 - 0.5, Math.sin(ang) * dist);
      peak.rotation.y = i * 0.7;
      mountainGroup.add(peak);

      // Snow cap
      const capGeo = new THREE.ConeGeometry(r * 0.36, h * 0.35, 5);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.7,
        flatShading: true,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(peak.position.x, h - (h * 0.35) / 2 - 0.45, peak.position.z);
      cap.rotation.y = peak.rotation.y;
      mountainGroup.add(cap);
    }
    scene.add(mountainGroup);

    // ===================== GREENHOUSE STRUCTURE =====================
    const GH_W = 5.4; // X span
    const GH_L = 9.4; // Z span
    const WALL_H = 1.65;
    const ARCH_TOP = 3.55;

    const ghGroup = new THREE.Group();
    scene.add(ghGroup);

    // Concrete perimeter foundation + interior gravel floor
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const basePad = new THREE.Mesh(new THREE.BoxGeometry(GH_W + 0.5, 0.14, GH_L + 0.5), baseMat);
    basePad.position.y = 0.07;
    basePad.receiveShadow = true;
    ghGroup.add(basePad);

    // Interior stone walkway along Z axis
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    for (let z = -4.0; z <= 4.1; z += 0.78) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.62), pathMat);
      slab.position.set(0, 0.15, z);
      slab.receiveShadow = true;
      ghGroup.add(slab);
    }

    // Galvanized steel material
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.72,
      roughness: 0.32,
    });

    // Helper: arch cross-section points
    const archCurvePoints = () => {
      const pts: THREE.Vector3[] = [];
      const halfW = GH_W / 2;
      pts.push(new THREE.Vector3(-halfW, 0.14, 0));
      pts.push(new THREE.Vector3(-halfW, WALL_H, 0));
      const archSegs = 16;
      for (let i = 1; i < archSegs; i++) {
        const t = i / archSegs;
        const angle = Math.PI * (1 - t);
        const x = Math.cos(angle) * halfW;
        const y = WALL_H + Math.sin(angle) * (ARCH_TOP - WALL_H);
        pts.push(new THREE.Vector3(x, y, 0));
      }
      pts.push(new THREE.Vector3(halfW, WALL_H, 0));
      pts.push(new THREE.Vector3(halfW, 0.14, 0));
      return pts;
    };

    const archPts = archCurvePoints();
    const archCurve = new THREE.CatmullRomCurve3(archPts);

    // 7 Arched Steel Ribs
    const ribCount = 7;
    for (let i = 0; i < ribCount; i++) {
      const z = -GH_L / 2 + (i / (ribCount - 1)) * GH_L;
      const ribGeo = new THREE.TubeGeometry(archCurve, 36, 0.045, 8, false);
      const rib = new THREE.Mesh(ribGeo, steelMat);
      rib.position.z = z;
      rib.castShadow = true;
      ghGroup.add(rib);
    }

    // Longitudinal purlins (left, right, shoulder, ridge)
    const purlinCoords: [number, number][] = [
      [-GH_W / 2, WALL_H],
      [GH_W / 2, WALL_H],
      [-GH_W * 0.34, WALL_H + (ARCH_TOP - WALL_H) * 0.72],
      [GH_W * 0.34, WALL_H + (ARCH_TOP - WALL_H) * 0.72],
      [0, ARCH_TOP],
    ];
    for (const [px, py] of purlinCoords) {
      const purlin = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, GH_L + 0.06, 8), steelMat);
      purlin.rotation.x = Math.PI / 2;
      purlin.position.set(px, py, 0);
      ghGroup.add(purlin);
    }

    // Front & back gable door frame posts
    for (const zSide of [-GH_L / 2, GH_L / 2]) {
      for (const xDoor of [-0.62, 0.62]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.25, 0.06), steelMat);
        post.position.set(xDoor, 1.25, zSide);
        ghGroup.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.06), steelMat);
      lintel.position.set(0, 2.38, zSide);
      ghGroup.add(lintel);
    }

    // Polycarbonate translucent shell (frosts visibly when cold!)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.19,
      roughness: 0.18,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Extruded arch skin built as curved strip mesh
    const skinSegments = 28;
    const sampled = archCurve.getPoints(skinSegments);
    const skinVerts: number[] = [];
    const skinIndices: number[] = [];
    for (let i = 0; i <= skinSegments; i++) {
      const p = sampled[i];
      skinVerts.push(p.x, p.y, -GH_L / 2);
      skinVerts.push(p.x, p.y, GH_L / 2);
      if (i < skinSegments) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        skinIndices.push(a, b, c, b, d, c);
      }
    }
    const skinGeo = new THREE.BufferGeometry();
    skinGeo.setAttribute("position", new THREE.Float32BufferAttribute(skinVerts, 3));
    skinGeo.setIndex(skinIndices);
    skinGeo.computeVertexNormals();
    const glassShell = new THREE.Mesh(skinGeo, glassMat);
    ghGroup.add(glassShell);

    // Back translucent gable panel
    const backShape = new THREE.Shape();
    backShape.moveTo(sampled[0].x, sampled[0].y);
    for (let i = 1; i < sampled.length; i++) {
      backShape.lineTo(sampled[i].x, sampled[i].y);
    }
    backShape.closePath();
    const backWall = new THREE.Mesh(new THREE.ShapeGeometry(backShape), glassMat);
    backWall.position.z = -GH_L / 2;
    ghGroup.add(backWall);

    // 2 Motorized Roof Vent Flaps (pivot smoothly open when vent_open === true!)
    const ventPivots: THREE.Group[] = [];
    const ventMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    for (const vz of [-2.1, 2.1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.05, ARCH_TOP - 0.04, vz);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.55), ventMat);
      flap.position.set(0.58, -0.05, 0);
      flap.rotation.z = -0.28;
      // Steel border around flap
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.05, 1.58), steelMat);
      frame.position.copy(flap.position);
      frame.rotation.copy(flap.rotation);
      frame.scale.set(1, 0.6, 1);
      pivot.add(flap);
      ghGroup.add(pivot);
      ventPivots.push(pivot);
    }

    // ===================== 4 RAISED CROP BEDS & 3D PLANTS =====================
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x261a12, roughness: 0.98 });
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x8c6d46, roughness: 0.9 });
    const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });

    const sectors = [
      { id: "A", x: -1.65, z: -2.15 },
      { id: "B", x: -1.65, z: 2.05 },
      { id: "C", x: 1.65, z: -2.15 },
      { id: "D", x: 1.65, z: 2.05 },
    ];

    const plantGroups: { group: THREE.Group; phase: number; sectorId: string; leafMats: THREE.MeshStandardMaterial[] }[] = [];

    for (const sec of sectors) {
      // Raised timber bed
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.34, 3.65), woodMat);
      bed.position.set(sec.x, 0.31, sec.z);
      bed.castShadow = true;
      bed.receiveShadow = true;
      ghGroup.add(bed);

      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 3.52), soilMat);
      soil.position.set(sec.x, 0.46, sec.z);
      soil.receiveShadow = true;
      ghGroup.add(soil);

      // 8 3D tomato/pepper plants per sector (32 total!)
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const px = sec.x + (col === 0 ? -0.36 : 0.36);
          const pz = sec.z - 1.28 + row * 0.85;
          const pGroup = new THREE.Group();
          pGroup.position.set(px, 0.49, pz);

          // Support stake
          const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1.18, 5), stakeMat);
          stake.position.set(0.05, 0.58, 0);
          pGroup.add(stake);

          // Main green stem
          const leafMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.34 + Math.random() * 0.04, 0.64, 0.31),
            roughness: 0.68,
            side: THREE.DoubleSide,
          });
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.96, 6), leafMat);
          stem.position.y = 0.48;
          pGroup.add(stem);

          // 7 layered foliage leaves
          for (let li = 0; li < 7; li++) {
            const lh = 0.24 + li * 0.11;
            const ang = li * 2.399;
            const leafGeo = new THREE.SphereGeometry(0.16, 6, 5);
            leafGeo.scale(1.35, 0.24, 0.72);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(Math.cos(ang) * 0.17, lh, Math.sin(ang) * 0.17);
            leaf.rotation.set(0.25, -ang, 0.28);
            leaf.castShadow = true;
            pGroup.add(leaf);
          }

          // 2 hanging red tomatoes
          for (let fi = 0; fi < 2; fi++) {
            const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), tomatoMat);
            fruit.position.set(fi === 0 ? 0.12 : -0.1, 0.42 + fi * 0.26, fi === 0 ? 0.08 : -0.1);
            pGroup.add(fruit);
          }

          ghGroup.add(pGroup);
          plantGroups.push({
            group: pGroup,
            phase: Math.random() * Math.PI * 2,
            sectorId: sec.id,
            leafMats: [leafMat],
          });
        }
      }
    }

    // Yellow Sticky Pest Trap in Sector D (real 3D detail!)
    const trapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.35, 6), steelMat);
    trapPole.position.set(1.02, 1.0, 1.9);
    ghGroup.add(trapPole);
    const trapCard = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.30, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, emissive: 0x713f12, emissiveIntensity: 0.15 })
    );
    trapCard.position.set(1.02, 1.56, 1.9);
    trapCard.rotation.y = 0.4;
    ghGroup.add(trapCard);

    // ===================== HOLOGRAPHIC DISEASE ANOMALY RING =====================
    const anomalyGroup = new THREE.Group();
    anomalyGroup.visible = false;
    const ringGeo = new THREE.RingGeometry(0.75, 0.92, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const anomalyRing = new THREE.Mesh(ringGeo, ringMat);
    anomalyRing.rotation.x = -Math.PI / 2;
    anomalyRing.position.y = 0.55;
    anomalyGroup.add(anomalyRing);

    const beamGeo = new THREE.CylinderGeometry(0.78, 0.88, 1.45, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const anomalyBeam = new THREE.Mesh(beamGeo, beamMat);
    anomalyBeam.position.y = 1.25;
    anomalyGroup.add(anomalyBeam);
    ghGroup.add(anomalyGroup);

    // ===================== 3D AGROGUARD EDGE HARDWARE NODE =====================
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(0.62, 0.14, 0.42);
    ghGroup.add(nodeGroup);

    // Aluminum mounting mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.45, 10), steelMat);
    mast.position.y = 0.725;
    mast.castShadow = true;
    nodeGroup.add(mast);

    // IP65 white/dark housing box
    const boxBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.34, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.1 })
    );
    boxBody.position.y = 1.32;
    boxBody.castShadow = true;
    nodeGroup.add(boxBody);

    // Emerald front accent faceplate
    const faceplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.35 })
    );
    faceplate.position.set(0, 1.41, 0.095);
    nodeGroup.add(faceplate);

    // Camera lens + White Ring LED facing Sector B crops (-X direction)
    const camLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.045, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15 })
    );
    camLens.rotation.z = Math.PI / 2;
    camLens.position.set(-0.15, 1.32, 0);
    nodeGroup.add(camLens);

    const ringLedMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const camRingLed = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 8, 24), ringLedMat);
    camRingLed.rotation.y = Math.PI / 2;
    camRingLed.position.set(-0.175, 1.32, 0);
    nodeGroup.add(camRingLed);

    // Volumetric Edge-CV Scan Cone (flashes when CV scan runs!)
    const scanConeGeo = new THREE.ConeGeometry(0.95, 2.2, 24, 1, true);
    const scanConeMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanCone = new THREE.Mesh(scanConeGeo, scanConeMat);
    scanCone.rotation.z = -Math.PI / 2 + 0.22;
    scanCone.position.set(-1.18, 1.06, 0);
    nodeGroup.add(scanCone);

    // MLX90614 Infrared Leaf Thermometer Laser Beam aimed at nearest leaf!
    const irPts = [new THREE.Vector3(-0.14, 1.24, 0.04), new THREE.Vector3(-1.35, 0.92, 0.25)];
    const irLineGeo = new THREE.BufferGeometry().setFromPoints(irPts);
    const irLineMat = new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.65 });
    const irLaser = new THREE.Line(irLineGeo, irLineMat);
    nodeGroup.add(irLaser);

    const irDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    );
    irDot.position.copy(irPts[1]);
    nodeGroup.add(irDot);

    // Tilted Solar Panel on top of the AgroGuard node
    const solarBezel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.34), steelMat);
    solarBezel.position.set(0, 1.62, 0);
    solarBezel.rotation.x = 0.36;
    nodeGroup.add(solarBezel);

    const solarFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.30),
      new THREE.MeshStandardMaterial({ map: createSolarTexture(), roughness: 0.25, metalness: 0.4 })
    );
    solarFace.position.set(0, 1.635, 0.005);
    solarFace.rotation.x = -Math.PI / 2 + 0.36;
    nodeGroup.add(solarFace);

    // Status Beacon LED on top
    const statusLedMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), statusLedMat);
    statusLed.position.set(0.11, 1.52, 0.06);
    nodeGroup.add(statusLed);

    const statusPointLight = new THREE.PointLight(0x10b981, 0.9, 3.2);
    statusPointLight.position.copy(statusLed.position);
    nodeGroup.add(statusPointLight);

    // ===================== OVERHEAD MICRO-SPRINKLER SYSTEM =====================
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.35 });
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });

    const sprinklerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, GH_L - 0.6, 8), pipeMat);
    sprinklerPipe.rotation.x = Math.PI / 2;
    sprinklerPipe.position.set(0, 3.15, 0);
    ghGroup.add(sprinklerPipe);

    const nozzleZList = [-3.3, -2.0, -0.7, 0.7, 2.0, 3.3];
    for (const nz of nozzleZList) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.12, 8), nozzleMat);
      nozzle.position.set(0, 3.07, nz);
      ghGroup.add(nozzle);
    }

    // 720 Animated 3D Water-Mist Droplet Particles!
    const mistCount = 720;
    const mistPositions = new Float32Array(mistCount * 3);
    const mistVel = new Float32Array(mistCount * 3);
    const mistNozzleIdx = new Uint8Array(mistCount);

    const resetParticle = (i: number) => {
      const nIdx = i % nozzleZList.length;
      mistNozzleIdx[i] = nIdx;
      const nz = nozzleZList[nIdx];
      mistPositions[i * 3] = (Math.random() - 0.5) * 0.08;
      mistPositions[i * 3 + 1] = 3.02 - Math.random() * 2.4;
      mistPositions[i * 3 + 2] = nz + (Math.random() - 0.5) * 0.08;

      const angle = Math.random() * Math.PI * 2;
      const spread = 0.55 + Math.random() * 1.45;
      mistVel[i * 3] = Math.cos(angle) * spread;
      mistVel[i * 3 + 1] = -(1.4 + Math.random() * 1.1);
      mistVel[i * 3 + 2] = Math.sin(angle) * spread * 0.72;
    };
    for (let i = 0; i < mistCount; i++) resetParticle(i);

    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute("position", new THREE.BufferAttribute(mistPositions, 3));
    const mistMat = new THREE.PointsMaterial({
      size: 0.19,
      map: createSoftParticleTexture(),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mistPoints = new THREE.Points(mistGeo, mistMat);
    mistPoints.visible = false;
    ghGroup.add(mistPoints);

    const mistGlow = new THREE.PointLight(0x38bdf8, 0, 10);
    mistGlow.position.set(0, 2.3, 0);
    ghGroup.add(mistGlow);

    // ===================== SUSPENDED IR GREENHOUSE HEATERS =====================
    const heaterBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.4 });
    const heaterRodMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.0,
      roughness: 0.3,
    });
    const heaterLights: THREE.PointLight[] = [];

    for (const hz of [-2.0, 2.0]) {
      const hUnit = new THREE.Group();
      hUnit.position.set(0, 2.75, hz);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.24), heaterBodyMat);
      hUnit.add(housing);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.0, 10), heaterRodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.y = -0.06;
      hUnit.add(rod);
      ghGroup.add(hUnit);

      const hLight = new THREE.PointLight(0xff7a1a, 0, 9.5);
      hLight.position.set(0, 2.55, hz);
      ghGroup.add(hLight);
      heaterLights.push(hLight);
    }

    // ===================== ANIMATION LOOP =====================
    let animId = 0;
    const clock = new THREE.Clock();
    const tmpColorDay = new THREE.Color(0x38bdf8);
    const tmpColorSunset = new THREE.Color(0x3b2454);
    const tmpColorNight = new THREE.Color(0x070d1d);
    const tmpSky = new THREE.Color();
    const healthyGreen = new THREE.Color(0x2d8a3e);
    const frostTint = new THREE.Color(0x93c5fd);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const state = liveRef.current;
      const { sensors: s, actuators: a, prediction: p, latestCv: cv, lastCvScanTs: scanTs } = state;

      // 1. Smooth camera preset transitions
      if (state.camLerping) {
        camera.position.lerp(state.targetCamPos, 0.08);
        controls.target.lerp(state.targetControls, 0.08);
        if (camera.position.distanceTo(state.targetCamPos) < 0.06) {
          state.camLerping = false;
        }
      }
      controls.update();

      // 2. Dynamic 24-hour Sky, Sun & Stars
      const h = s.sim_hour;
      let daylight = 0;
      if (h >= 6 && h <= 19) {
        daylight = Math.sin(((h - 6) / 13) * Math.PI);
      }
      if (daylight > 0.35) {
        tmpSky.copy(tmpColorSunset).lerp(tmpColorDay, (daylight - 0.35) / 0.65);
      } else {
        tmpSky.copy(tmpColorNight).lerp(tmpColorSunset, daylight / 0.35);
      }
      scene.background = tmpSky;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(tmpSky);
      }
      starMat.opacity = Math.max(0, 0.92 - daylight * 1.45);
      sunLight.intensity = 0.35 + daylight * 1.65;
      sunLight.color.setHex(daylight < 0.25 ? 0x93c5fd : daylight < 0.55 ? 0xfdba74 : 0xfff8eb);
      const sunAngle = ((h - 6) / 12) * Math.PI;
      sunLight.position.set(Math.cos(sunAngle) * 16, Math.max(4, Math.sin(sunAngle) * 18), 9);
      hemiLight.intensity = 0.35 + daylight * 0.55;

      // 3. Frost Visualization on Polycarbonate Dome & Ground
      const frostSeverity = Math.max(0, Math.min(1, (2.2 - s.leaf_temp_c) / 3.8));
      glassMat.opacity = 0.17 + frostSeverity * 0.28;
      glassMat.color.setHex(frostSeverity > 0.25 ? 0xbae6fd : 0xe0f2fe);
      groundMat.color.setHex(0x1d2b22).lerp(new THREE.Color(0x2d435c), frostSeverity * 0.65);

      // 4. Motorized Roof Vents Animation
      const targetVentAngle = a.vent_open ? 0.58 : 0.0;
      for (const vp of ventPivots) {
        vp.rotation.z += (targetVentAngle - vp.rotation.z) * 0.1;
      }

      // 5. Overhead Micro-Sprinkler Particle Mist Animation
      mistPoints.visible = a.sprinkler_on;
      if (a.sprinkler_on) {
        const posArr = mistGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < mistCount; i++) {
          posArr[i * 3] += mistVel[i * 3] * dt;
          posArr[i * 3 + 1] += mistVel[i * 3 + 1] * dt;
          posArr[i * 3 + 2] += mistVel[i * 3 + 2] * dt;
          if (posArr[i * 3 + 1] < 0.45) {
            const nz = nozzleZList[mistNozzleIdx[i]];
            posArr[i * 3] = (Math.random() - 0.5) * 0.07;
            posArr[i * 3 + 1] = 3.02;
            posArr[i * 3 + 2] = nz + (Math.random() - 0.5) * 0.07;
          }
        }
        mistGeo.attributes.position.needsUpdate = true;
        mistGlow.intensity = 1.6 + Math.sin(elapsed * 5) * 0.25;
      } else {
        mistGlow.intensity = 0;
      }

      // 6. IR Heaters Glowing Orange + Warm Dynamic Point Lights
      const targetHeat = a.heater_on ? 1.0 : 0.0;
      heaterRodMat.emissiveIntensity += (targetHeat * 3.8 - heaterRodMat.emissiveIntensity) * 0.12;
      for (const hl of heaterLights) {
        const targetInt = a.heater_on ? 4.2 + Math.sin(elapsed * 6) * 0.25 : 0;
        hl.intensity += (targetInt - hl.intensity) * 0.12;
      }

      // 7. AgroGuard Node Status LED & Edge-CV Volumetric Scan Cone
      const isCrit = p.frost_level === "critical" || (cv && cv.severity === "critical");
      const isWarn = p.frost_level === "warning" || (cv && cv.severity === "warning");
      const ledColor = isCrit ? 0xf43f5e : isWarn ? 0xf59e0b : 0x10b981;
      statusLedMat.color.setHex(ledColor);
      statusPointLight.color.setHex(ledColor);
      statusPointLight.intensity = isCrit ? 0.6 + Math.abs(Math.sin(elapsed * 8)) * 1.4 : 0.85;

      // Edge-CV scan beam triggers for 4.5s after any CV scan
      const sinceScan = Date.now() / 1000 - scanTs;
      if (scanTs > 0 && sinceScan < 4.5) {
        const fade = Math.max(0, 1 - sinceScan / 4.5);
        scanConeMat.opacity = 0.28 * fade * (0.65 + 0.35 * Math.sin(elapsed * 14));
        scanCone.rotation.y = Math.sin(elapsed * 4.5) * 0.45;
        ringLedMat.color.setHex(0xffffff);
      } else {
        scanConeMat.opacity = 0;
        ringLedMat.color.setHex(0x34d399);
      }

      // 8. Disease Anomaly Holographic Beacon & Plant Sway
      const secTarget = getSectorCenter(cv);
      if (secTarget) {
        anomalyGroup.visible = true;
        anomalyGroup.position.set(secTarget.x, 0, secTarget.z);
        ringMat.color.setHex(secTarget.color);
        beamMat.color.setHex(secTarget.color);
        const pulse = 1 + Math.sin(elapsed * 5) * 0.12;
        anomalyRing.scale.set(pulse, pulse, 1);
        beamMat.opacity = 0.12 + Math.abs(Math.sin(elapsed * 4)) * 0.12;
      } else {
        anomalyGroup.visible = false;
      }

      const infectedSecId =
        cv?.disease_id === "powdery_mildew"
          ? "A"
          : cv?.disease_id === "late_blight"
          ? "B"
          : cv?.disease_id === "scab_rust"
          ? "C"
          : cv?.disease_id === "sticky_trap_pests"
          ? "D"
          : null;

      for (const pl of plantGroups) {
        const swayAmp = a.vent_open || a.sprinkler_on ? 0.045 : 0.016;
        pl.group.rotation.z = Math.sin(elapsed * 2.1 + pl.phase) * swayAmp;

        for (const lm of pl.leafMats) {
          if (infectedSecId && pl.sectorId === infectedSecId) {
            lm.color.setHex(cv?.disease_id === "powdery_mildew" ? 0x8fa88d : 0x7c6a2b);
          } else {
            lm.color.copy(healthyGreen).lerp(frostTint, frostSeverity * 0.42);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const hoursFormatted = `${String(Math.floor(sensors.sim_hour)).padStart(2, "0")}:${String(
    Math.floor((sensors.sim_hour % 1) * 60)
  ).padStart(2, "0")}`;

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950 shadow-2xl xl:h-[465px]">
      {/* Three.js WebGL Mount */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Live Sensor Telemetry Strip */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-1.5 backdrop-blur-md">
          <Thermometer className="h-4 w-4 text-sky-400" />
          <div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
              {lang === "ru" ? "Воздух" : "Аба"}
            </div>
            <div className="text-sm font-extrabold text-white">{sensors.air_temp_c.toFixed(1)}°C</div>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-md ${
            sensors.leaf_temp_c <= 1.5
              ? "border-rose-500/70 bg-rose-950/75"
              : "border-emerald-500/40 bg-slate-950/75"
          }`}
        >
          <Snowflake className={`h-4 w-4 ${sensors.leaf_temp_c <= 1.5 ? "text-rose-400 animate-pulse" : "text-emerald-400"}`} />
          <div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-300">
              {lang === "ru" ? "Лист (ИК)" : "Жалбырак (ИК)"}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-white">{sensors.leaf_temp_c.toFixed(1)}°C</span>
              <span className="text-[10px] font-semibold text-sky-300">
                ({prediction.leaf_air_delta_c >= 0 ? "+" : ""}{prediction.leaf_air_delta_c.toFixed(1)}°)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-1.5 backdrop-blur-md">
          <div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
              {lang === "ru" ? "Риск заморозка (6ч)" : "Үшүк коркунучу (6с)"}
            </div>
            <div
              className={`text-sm font-extrabold ${
                prediction.frost_level === "critical"
                  ? "text-rose-400"
                  : prediction.frost_level === "warning"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {prediction.frost_risk_pct}% • min {prediction.min_predicted_leaf_c}°C
            </div>
          </div>
        </div>
      </div>

      {/* Top-Right Clock + Hardware Node Indicator */}
      <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-1.5 text-xs font-bold text-slate-200 backdrop-blur-md">
          <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>{hoursFormatted}</span>
          <span className="text-slate-500">|</span>
          <span className="text-sky-300">{sensors.humidity_pct.toFixed(0)}% RH</span>
        </div>
        {actuators.failsafe_active && (
          <div className="rounded-lg border border-rose-500/80 bg-rose-600/90 px-2.5 py-1 text-[10.5px] font-extrabold text-white shadow-lg animate-pulse">
            ⚡ HARDWARE FAIL-SAFE ACTIVE
          </div>
        )}
      </div>

      {/* Bottom-Left Camera Presets */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
          <button
            key={key}
            onClick={() => selectPreset(key)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-md transition ${
              preset === key
                ? "border-emerald-400/80 bg-emerald-500/25 text-emerald-200"
                : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white"
            }`}
          >
            {key === "node" ? <Cpu className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {lang === "ru" ? CAMERA_PRESETS[key].label_ru : CAMERA_PRESETS[key].label_kg}
          </button>
        ))}
      </div>

      {/* Bottom-Right Live 3D Actuator Status Pills */}
      <div className="pointer-events-none absolute right-3 bottom-3 flex flex-wrap justify-end gap-1.5">
        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md transition ${
            actuators.sprinkler_on
              ? "border-sky-400/80 bg-sky-500/30 text-sky-100 shadow-lg shadow-sky-500/20"
              : "border-slate-800 bg-slate-950/65 text-slate-500"
          }`}
        >
          <Droplets className={`h-3.5 w-3.5 ${actuators.sprinkler_on ? "animate-bounce text-sky-300" : ""}`} />
          {lang === "ru" ? "Микродождевание" : "Микросугаруу"}
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md transition ${
            actuators.heater_on
              ? "border-orange-400/80 bg-orange-500/30 text-orange-100 shadow-lg shadow-orange-500/20"
              : "border-slate-800 bg-slate-950/65 text-slate-500"
          }`}
        >
          <Flame className={`h-3.5 w-3.5 ${actuators.heater_on ? "animate-pulse text-orange-300" : ""}`} />
          {lang === "ru" ? "ИК-Обогрев" : "ИК-Жылытуу"}
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md transition ${
            actuators.vent_open
              ? "border-emerald-400/80 bg-emerald-500/25 text-emerald-100"
              : "border-slate-800 bg-slate-950/65 text-slate-500"
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          {lang === "ru" ? "Вентиляция" : "Желдетүү"}
        </div>
      </div>
    </div>
  );
};
