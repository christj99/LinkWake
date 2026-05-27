import type { Container } from "pixi.js";
import type { InputController } from "./input";
import type { ScoreSnapshot } from "./scoring";
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
  onEnd: (summary: ScoreSnapshot) => void;
};

export type RuntimeOptions = {
  level: LevelScript;
  canvas: HTMLCanvasElement;
  stage: Container;
  input: InputController;
  callbacks: RuntimeCallbacks;
};

export class GameRuntime {
  constructor(_options: RuntimeOptions) {}

  update(_deltaMs: number): RuntimeState {
    throw new Error("not implemented");
  }

  destroy(): void {
    throw new Error("not implemented");
  }
}

