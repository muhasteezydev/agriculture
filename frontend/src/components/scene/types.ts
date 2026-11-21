import { CVResult } from "../../types";

export type CameraPreset = "hero" | "inside" | "node" | "top";

export const CAMERA_PRESETS: Record<
  CameraPreset,
  {
    pos: [number, number, number];
    target: [number, number, number];
    label_ru: string;
    label_kg: string;
  }
> = {
  hero: {
    pos: [8.4, 4.8, 8.2],
    target: [0, 1.4, 0],
    label_ru: "Снаружи",
    label_kg: "Сырттан",
  },
  inside: {
    pos: [0.0, 1.75, 3.6],
    target: [0, 1.05, -1.4],
    label_ru: "Внутри",
    label_kg: "Ичинде",
  },
  node: {
    pos: [2.2, 1.95, 2.1],
    target: [0.55, 1.35, 0.35],
    label_ru: "Датчик",
    label_kg: "Датчик",
  },
  top: {
    pos: [0.2, 10.6, 4.6],
    target: [0, 0.8, 0],
    label_ru: "Сверху",
    label_kg: "Үстүнөн",
  },
};

// Matches converted arched-greenhouse.glb footprint (5.60m x 3.97m x 7.50m)
export const GH_W = 5.6;
export const GH_L = 7.5;
export const WALL_H = 1.75;
export const ARCH_TOP = 3.97;

export const SECTORS = [
  { id: "A", crop: "tomato" as const, x: -1.45, z: -1.65 },
  { id: "B", crop: "tomato" as const, x: -1.45, z: 1.65 },
  { id: "C", crop: "strawberry" as const, x: 1.45, z: -1.65 },
  { id: "D", crop: "strawberry" as const, x: 1.45, z: 1.65 },
] as const;

export function getSectorCenter(cv: CVResult | null): { x: number; z: number; color: number } | null {
  if (!cv || cv.disease_id === "healthy") return null;
  if (cv.disease_id === "powdery_mildew") return { x: -1.45, z: -1.65, color: 0xb85a1e };
  if (cv.disease_id === "late_blight") return { x: -1.45, z: 1.65, color: 0xb92b27 };
  if (cv.disease_id === "scab_rust") return { x: 1.45, z: -1.65, color: 0xd97706 };
  if (cv.disease_id === "sticky_trap_pests") return { x: 1.45, z: 1.65, color: 0xb92b27 };
  return null;
}

export function getInfectedSectorId(cv: CVResult | null): string | null {
  if (!cv) return null;
  if (cv.disease_id === "powdery_mildew") return "A";
  if (cv.disease_id === "late_blight") return "B";
  if (cv.disease_id === "scab_rust") return "C";
  if (cv.disease_id === "sticky_trap_pests") return "D";
  return null;
}
