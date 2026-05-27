import { Graphics, type Container } from "pixi.js";
import type { RandomSource } from "../rng";
import type {
  Act,
  Archetype,
  LevelScript,
  ObstacleType,
  WavePattern,
} from "../../types/level-script";

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

export type SurgeArchetypeConfig = {
  scrollSpeed: number;
  playerMoveSpeed: number;
  spawnRateMultiplier: number;
};

export const SURGE_ARCHETYPE_CONFIG: Record<Archetype, SurgeArchetypeConfig> = {
  longform: { scrollSpeed: 220, playerMoveSpeed: 280, spawnRateMultiplier: 0.85 },
  reference: { scrollSpeed: 320, playerMoveSpeed: 320, spawnRateMultiplier: 1 },
  commerce: { scrollSpeed: 420, playerMoveSpeed: 360, spawnRateMultiplier: 1.25 },
  media: { scrollSpeed: 320, playerMoveSpeed: 320, spawnRateMultiplier: 1 },
  data: { scrollSpeed: 280, playerMoveSpeed: 300, spawnRateMultiplier: 1 },
  generic: { scrollSpeed: 320, playerMoveSpeed: 320, spawnRateMultiplier: 1 },
};

export type PlayerRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type SurgeUpdateOptions = {
  activeAct: Act | undefined;
  deltaMs: number;
  elapsedMs: number;
  playfieldHeight: number;
  player: PlayerRect;
  canCollide: boolean;
};

export type SurgeUpdateResult = {
  hits: number;
};

export type SurgeRun = {
  update: (options: SurgeUpdateOptions) => SurgeUpdateResult;
  destroy: () => void;
};

type Obstacle = {
  graphics: Graphics;
  x: number;
  y: number;
  width: number;
  height: number;
  pulse?: ObstacleTreatment["pulse"];
};

export function createSurgeRun(options: SurgeRunOptions): SurgeRun {
  return new SurgeRuntime(options);
}

export function surgeConfigFor(archetype: Archetype): SurgeArchetypeConfig {
  return SURGE_ARCHETYPE_CONFIG[archetype];
}

export function drawSurgeBackground(
  graphics: Graphics,
  level: LevelScript,
  elapsedMs: number,
  playfieldHeight: number,
): void {
  const config = surgeConfigFor(level.archetype);

  graphics.clear();
  graphics.rect(0, 0, VIRTUAL_WIDTH, playfieldHeight);
  graphics.fill({ color: 0x050505 });
  graphics.rect(0, 0, VIRTUAL_WIDTH, playfieldHeight);
  graphics.fill({ color: colorNumber(paletteColor(level, 0)), alpha: 0.18 });

  switch (level.archetype) {
    case "longform":
      drawLongformTexture(graphics, level, playfieldHeight);
      break;
    case "reference":
      drawReferenceTexture(graphics, level, elapsedMs, playfieldHeight, config);
      break;
    case "commerce":
      drawCommerceTexture(graphics, level, elapsedMs, playfieldHeight, config);
      break;
  }
}

class SurgeRuntime implements SurgeRun {
  private readonly level: LevelScript;
  private readonly layer: Container;
  private readonly rng: RandomSource;
  private readonly config: SurgeArchetypeConfig;
  private obstacles: Obstacle[] = [];
  private spawnAccumulator = 0;
  private spawnIndexInAct = 0;
  private activeActKey = "";

  constructor(options: SurgeRunOptions) {
    this.level = options.level;
    this.layer = options.layer;
    this.rng = options.rng;
    this.config = surgeConfigFor(this.level.archetype);
  }

  update(options: SurgeUpdateOptions): SurgeUpdateResult {
    this.updateActState(options.activeAct);
    this.updateObstacles(options);
    this.spawnForAct(options);

    const hits = options.canCollide ? this.collectHits(options.player) : 0;

    return { hits };
  }

  destroy(): void {
    for (const obstacle of this.obstacles) {
      obstacle.graphics.destroy();
    }

    this.obstacles = [];
  }

  private updateActState(activeAct: Act | undefined): void {
    const nextKey = activeAct ? `${activeAct.t}:${activeAct.kind}` : "none";

    if (nextKey !== this.activeActKey) {
      this.activeActKey = nextKey;
      this.spawnAccumulator = 0;
      this.spawnIndexInAct = 0;
    }
  }

  private updateObstacles(options: SurgeUpdateOptions): void {
    const deltaSeconds = options.deltaMs / 1000;

    for (const obstacle of this.obstacles) {
      obstacle.y += this.config.scrollSpeed * deltaSeconds;
      obstacle.graphics.position.set(obstacle.x, obstacle.y);

      if (obstacle.pulse) {
        const phase =
          (Math.sin((options.elapsedMs / obstacle.pulse.periodMs) * Math.PI * 2) +
            1) /
          2;

        obstacle.graphics.alpha =
          obstacle.pulse.minAlpha +
          phase * (obstacle.pulse.maxAlpha - obstacle.pulse.minAlpha);
      }
    }

    this.obstacles = this.obstacles.filter((obstacle) => {
      const alive = obstacle.y <= options.playfieldHeight + 16;

      if (!alive) {
        obstacle.graphics.destroy();
      }

      return alive;
    });
  }

  private spawnForAct(options: SurgeUpdateOptions): void {
    const act = options.activeAct;

    if (!act || (act.kind !== "calm" && act.kind !== "obstacle_wave")) {
      return;
    }

    const spawnRate =
      spawnRateForDensity(act.payload.density) * this.config.spawnRateMultiplier;

    this.spawnAccumulator += spawnRate * (options.deltaMs / 1000);

    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;

      if (act.kind === "calm") {
        this.spawnObstacle("random", "paragraph", options.elapsedMs, act.t);
      } else {
        this.spawnObstacle(
          act.payload.pattern,
          act.payload.obstacle_type,
          options.elapsedMs,
          act.t,
        );
      }
    }
  }

  private spawnObstacle(
    pattern: WavePattern,
    obstacleType: ObstacleType,
    elapsedMs: number,
    actStartMs: number,
  ): void {
    const treatment = SURGE_OBSTACLE_TREATMENTS[obstacleType];
    const x = this.patternX(pattern, elapsedMs - actStartMs, treatment.width);
    const y = -treatment.height;
    const graphics = new Graphics();
    const color = colorNumber(paletteColor(this.level, treatment.colorSlot));

    graphics.rect(
      -treatment.width / 2,
      0,
      treatment.width,
      treatment.height,
    );
    graphics.fill({ color, alpha: treatment.alpha });
    graphics.rect(
      -treatment.width / 2 + 0.5,
      0.5,
      treatment.width - 1,
      treatment.height - 1,
    );
    graphics.stroke({ color: 0xf5f7fb, alpha: 0.18, width: 1 });
    graphics.position.set(x, y);
    this.layer.addChild(graphics);

    this.obstacles.push({
      graphics,
      x,
      y,
      width: treatment.width,
      height: treatment.height,
      pulse: treatment.pulse,
    });
    this.spawnIndexInAct += 1;
  }

  private patternX(
    pattern: WavePattern,
    elapsedMsInAct: number,
    obstacleWidth: number,
  ): number {
    const halfWidth = obstacleWidth / 2;

    switch (pattern) {
      case "sine":
        return clamp(
          240 + Math.sin((elapsedMsInAct / 800) * Math.PI * 2) * 140,
          halfWidth,
          480 - halfWidth,
        );
      case "alternating":
        return this.spawnIndexInAct % 2 === 0 ? 80 : 400;
      case "random":
        return this.rng.uniform(16, 464);
    }
  }

  private collectHits(player: PlayerRect): number {
    let hits = 0;

    this.obstacles = this.obstacles.filter((obstacle) => {
      const hit = intersects(player, obstacleRect(obstacle));

      if (hit) {
        hits += 1;
        obstacle.graphics.destroy();
      }

      return !hit;
    });

    return hits;
  }
}

const VIRTUAL_WIDTH = 480;

export function spawnRateForDensity(density: number): number {
  return lerp(0.5, 7, density);
}

function obstacleRect(obstacle: Obstacle): PlayerRect {
  return {
    left: obstacle.x - obstacle.width / 2,
    right: obstacle.x + obstacle.width / 2,
    top: obstacle.y,
    bottom: obstacle.y + obstacle.height,
  };
}

function intersects(a: PlayerRect, b: PlayerRect): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function paletteColor(level: LevelScript, index: number): string {
  const color =
    level.sensory.palette[index] ??
    level.sensory.palette[level.sensory.palette.length - 1];

  if (!color) {
    throw new Error(`Missing palette color for ${level.url_key}`);
  }

  return color;
}

function colorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function drawLongformTexture(
  graphics: Graphics,
  level: LevelScript,
  playfieldHeight: number,
): void {
  const color = colorNumber(paletteColor(level, 1));

  for (const x of [120, 360]) {
    graphics.rect(x, 0, 1, playfieldHeight);
    graphics.fill({ color, alpha: 0.06 });
  }
}

function drawReferenceTexture(
  graphics: Graphics,
  level: LevelScript,
  elapsedMs: number,
  playfieldHeight: number,
  config: SurgeArchetypeConfig,
): void {
  const gridSize = 80;
  const offset = ((elapsedMs / 1000) * config.scrollSpeed * 0.5) % gridSize;
  const color = mixColor(
    colorNumber(paletteColor(level, 0)),
    0xf5f7fb,
    0.35,
  );

  for (let x = 0; x <= VIRTUAL_WIDTH; x += gridSize) {
    graphics.rect(x, 0, 1, playfieldHeight);
    graphics.fill({ color, alpha: 0.08 });
  }

  for (let y = -gridSize + offset; y <= playfieldHeight; y += gridSize) {
    graphics.rect(0, y, VIRTUAL_WIDTH, 1);
    graphics.fill({ color, alpha: 0.08 });
  }
}

function drawCommerceTexture(
  graphics: Graphics,
  level: LevelScript,
  elapsedMs: number,
  playfieldHeight: number,
  config: SurgeArchetypeConfig,
): void {
  const spacing = 32;
  const offset = ((elapsedMs / 1000) * config.scrollSpeed) % spacing;
  const color = colorNumber(paletteColor(level, 2));

  for (let startX = -playfieldHeight + offset; startX < VIRTUAL_WIDTH; startX += spacing) {
    graphics.moveTo(startX, playfieldHeight);
    graphics.lineTo(startX + playfieldHeight, 0);
    graphics.stroke({ color, alpha: 0.05, width: 1 });
  }
}

function mixColor(from: number, to: number, amount: number): number {
  const fromRed = (from >> 16) & 255;
  const fromGreen = (from >> 8) & 255;
  const fromBlue = from & 255;
  const toRed = (to >> 16) & 255;
  const toGreen = (to >> 8) & 255;
  const toBlue = to & 255;
  const red = Math.round(lerp(fromRed, toRed, amount));
  const green = Math.round(lerp(fromGreen, toGreen, amount));
  const blue = Math.round(lerp(fromBlue, toBlue, amount));

  return (red << 16) | (green << 8) | blue;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(min: number, max: number, value: number): number {
  return min + (max - min) * value;
}
