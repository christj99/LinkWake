import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { InputController, type PlayfieldMetrics } from "./input";
import { mulberry32, seedFromHex } from "./rng";
import { ScoreState, type ScoreSnapshot } from "./scoring";
import { createSurgeRun, type PlayerRect, type SurgeRun } from "./verbs/surge";
import type { LevelScript } from "../types/level-script";

export const VIRTUAL_WIDTH = 480;
export const PLAYER_SIZE = 32;
export const PLAYER_MIN_X = PLAYER_SIZE / 2;
export const PLAYER_MAX_X = VIRTUAL_WIDTH - PLAYER_SIZE / 2;
export const PLAYER_BOTTOM_OFFSET = 80;
export const SCROLL_SPEED = 320;

export type PreviewState = {
  kind: "preview";
};

export type PlayingState = {
  kind: "playing";
  level: LevelScript;
  elapsedMs: number;
  score: number;
};

export type EndedState = {
  kind: "ended";
  level: LevelScript;
  score: number;
  bestScore: number;
};

export type RuntimeState = PreviewState | PlayingState | EndedState;

export type RuntimeCallbacks = {
  onEnd?: (summary: ScoreSnapshot) => void;
};

export type RuntimeOptions = {
  level: LevelScript;
  canvas: HTMLCanvasElement;
  stage: Container;
  callbacks?: RuntimeCallbacks;
};

export class GameRuntime {
  private readonly canvas: HTMLCanvasElement;
  private readonly stage: Container;
  private readonly level: LevelScript;
  private readonly callbacks: RuntimeCallbacks;
  private readonly root = new Container();
  private readonly playfieldBackground = new Graphics();
  private readonly surgeLayer = new Container();
  private readonly player = new Graphics();
  private readonly flash = new Graphics();
  private readonly scoreText: Text;
  private readonly levelText: Text;
  private readonly input: InputController;
  private readonly scoreState: ScoreState;
  private readonly surge: SurgeRun;
  private state: RuntimeState;
  private elapsedMs = 0;
  private accumulatedMs = 0;
  private playerX = VIRTUAL_WIDTH / 2;
  private invulnerableUntilMs = 0;
  private flashUntilMs = 0;

  constructor(options: RuntimeOptions) {
    this.canvas = options.canvas;
    this.stage = options.stage;
    this.level = options.level;
    this.callbacks = options.callbacks ?? {};
    this.scoreState = new ScoreState(this.level);
    this.scoreText = new Text({
      text: this.scoreLabel,
      style: new TextStyle({
        fill: 0xf5f7fb,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 28,
        fontWeight: "700",
      }),
    });
    this.levelText = new Text({
      text: new URL(this.level.url_key).host,
      style: new TextStyle({
        fill: 0x9aa3b2,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
      }),
    });
    this.input = new InputController({
      canvas: this.canvas,
      getMetrics: () => this.metrics,
      initialPlayerX: this.playerX,
      minX: PLAYER_MIN_X,
      maxX: PLAYER_MAX_X,
    });
    this.surge = createSurgeRun({
      level: this.level,
      layer: this.surgeLayer,
      rng: mulberry32(seedFromHex(this.level.rng_seed)),
    });
    this.state = {
      kind: "playing",
      level: this.level,
      elapsedMs: 0,
      score: this.scoreState.score,
    };

    this.root.addChild(
      this.playfieldBackground,
      this.surgeLayer,
      this.player,
      this.flash,
      this.scoreText,
      this.levelText,
    );
    this.stage.addChild(this.root);
    this.drawPlayer();
    this.renderStatic();
  }

  update(deltaMs: number): RuntimeState {
    if (this.state.kind === "ended") {
      return this.state;
    }

    this.renderStatic();
    this.accumulatedMs += Math.min(deltaMs, 100);

    while (this.accumulatedMs >= FIXED_STEP_MS && this.state.kind === "playing") {
      this.step(FIXED_STEP_MS);
      this.accumulatedMs -= FIXED_STEP_MS;
    }

    this.updateDisplay();

    if (this.elapsedMs >= this.level.duration_ms) {
      return this.finish();
    }

    return this.state;
  }

  finish(): EndedState {
    if (this.state.kind === "ended") {
      return this.state;
    }

    const summary = this.scoreState.finish();

    this.state = {
      kind: "ended",
      level: this.level,
      score: summary.score,
      bestScore: summary.bestScore,
    };
    this.callbacks.onEnd?.(summary);

    return this.state;
  }

  destroy(): void {
    this.input.dispose();
    this.surge.destroy();
    this.stage.removeChild(this.root);
    this.root.destroy({ children: true });
  }

  private get metrics(): PlayfieldMetrics {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const scale = Math.min(width / VIRTUAL_WIDTH, height / MIN_VIRTUAL_HEIGHT);

    return {
      virtualWidth: VIRTUAL_WIDTH,
      virtualHeight: height / scale,
      scale,
      offsetX: (width - VIRTUAL_WIDTH * scale) / 2,
      offsetY: 0,
    };
  }

  private get scoreLabel(): string {
    return this.scoreState.score.toLocaleString("en-US");
  }

  private step(deltaMs: number): void {
    const metrics = this.metrics;
    const activeAct = this.level.acts.find(
      (act) =>
        this.elapsedMs >= act.t && this.elapsedMs < act.t + act.duration,
    );

    this.elapsedMs += deltaMs;
    this.playerX = this.input.update(deltaMs / 1000, this.playerX);

    const playerY = this.playerY(metrics.virtualHeight);
    const result = this.surge.update({
      activeAct,
      deltaMs,
      elapsedMs: this.elapsedMs,
      playfieldHeight: metrics.virtualHeight,
      player: this.playerRect(playerY),
      canCollide: this.elapsedMs >= this.invulnerableUntilMs,
    });

    if (result.hits > 0) {
      this.scoreState.applyHit();
      this.invulnerableUntilMs = this.elapsedMs + 200;
      this.flashUntilMs = this.elapsedMs + 80;
    }

    this.state = {
      kind: "playing",
      level: this.level,
      elapsedMs: this.elapsedMs,
      score: this.scoreState.score,
    };
  }

  private renderStatic(): void {
    const metrics = this.metrics;
    const backgroundColor = colorNumber(paletteColor(this.level, 0));

    this.root.scale.set(metrics.scale);
    this.root.position.set(metrics.offsetX, metrics.offsetY);
    this.playfieldBackground.clear();
    this.playfieldBackground.rect(0, 0, VIRTUAL_WIDTH, metrics.virtualHeight);
    this.playfieldBackground.fill({ color: 0x050505 });
    this.playfieldBackground.rect(0, 0, VIRTUAL_WIDTH, metrics.virtualHeight);
    this.playfieldBackground.fill({ color: backgroundColor, alpha: 0.18 });
    this.levelText.position.set(28, 62);
    this.player.position.set(this.playerX, this.playerY(metrics.virtualHeight));
  }

  private updateDisplay(): void {
    this.scoreText.text = this.scoreLabel;
    this.scoreText.position.set(28, 26);

    this.flash.clear();

    if (this.elapsedMs < this.flashUntilMs) {
      const alpha = ((this.flashUntilMs - this.elapsedMs) / 80) * 0.3;
      const metrics = this.metrics;

      this.flash.rect(0, 0, VIRTUAL_WIDTH, metrics.virtualHeight);
      this.flash.fill({ color: colorNumber(paletteColor(this.level, 2)), alpha });
    }
  }

  private drawPlayer(): void {
    this.player.clear();
    this.player.roundRect(
      -PLAYER_SIZE / 2,
      -PLAYER_SIZE / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
      6,
    );
    this.player.fill({ color: colorNumber(paletteColor(this.level, 1)) });
    this.player.roundRect(
      -PLAYER_SIZE / 2 + 0.5,
      -PLAYER_SIZE / 2 + 0.5,
      PLAYER_SIZE - 1,
      PLAYER_SIZE - 1,
      6,
    );
    this.player.stroke({ color: 0xf5f7fb, alpha: 0.7, width: 2 });
  }

  private playerY(playfieldHeight: number): number {
    return playfieldHeight - PLAYER_BOTTOM_OFFSET;
  }

  private playerRect(playerY: number): PlayerRect {
    return {
      left: this.playerX - PLAYER_SIZE / 2,
      right: this.playerX + PLAYER_SIZE / 2,
      top: playerY - PLAYER_SIZE / 2,
      bottom: playerY + PLAYER_SIZE / 2,
    };
  }
}

const FIXED_STEP_MS = 1000 / 60;
const MIN_VIRTUAL_HEIGHT = 640;

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
