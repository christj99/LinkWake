import type { Container } from "pixi.js";
import type { RandomSource } from "../rng";
import type { LevelScript, ObstacleType } from "../../types/level-script";

export type ObstacleTreatment = {
  width: number;
  height: number;
  colorSlot: number;
  alpha: number;
  pulse?: {
    periodMs: number;
    minAlpha: number;
    maxAlpha: number;
  };
};

export const SURGE_OBSTACLE_TREATMENTS: Record<
  ObstacleType,
  ObstacleTreatment
> = {
  paragraph: { width: 120, height: 16, colorSlot: 0, alpha: 0.7 },
  cta: { width: 40, height: 40, colorSlot: 2, alpha: 1 },
  ad: {
    width: 80,
    height: 60,
    colorSlot: 3,
    alpha: 0.7,
    pulse: { periodMs: 600, minAlpha: 0.7, maxAlpha: 1 },
  },
  header: { width: 96, height: 24, colorSlot: 0, alpha: 0.9 },
  image: { width: 64, height: 64, colorSlot: 1, alpha: 1 },
};

export type SurgeRunOptions = {
  level: LevelScript;
  layer: Container;
  rng: RandomSource;
};

export function createSurgeRun(_options: SurgeRunOptions): never {
  throw new Error("not implemented");
}

