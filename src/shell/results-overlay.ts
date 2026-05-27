import { Container, Graphics, Rectangle, Text, TextStyle } from "pixi.js";

import type { LevelScript } from "../types/level-script";

export type ResultsOverlay = Container & {
  layout: (width: number, height: number) => void;
};

export type ResultsOverlayOptions = {
  level: LevelScript;
  score: number;
  bestScore: number;
  onReturn: () => void;
};

export function createResultsOverlay(
  options: ResultsOverlayOptions,
): ResultsOverlay {
  const overlay = new Container() as ResultsOverlay;
  const dim = new Graphics();
  const host = new Text({
    text: new URL(options.level.url_key).host,
    style: new TextStyle({
      fill: 0x9aa3b2,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 16,
    }),
  });
  const title = new Text({
    text: "Run Complete",
    style: new TextStyle({
      fill: 0xf5f7fb,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 44,
      fontWeight: "700",
    }),
  });
  const score = new Text({
    text: `${options.score.toLocaleString("en-US")} / ${options.level.scoring.max_score.toLocaleString("en-US")}`,
    style: new TextStyle({
      fill: 0xf5f7fb,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 24,
    }),
  });
  const best = new Text({
    text: `Best: ${options.bestScore.toLocaleString("en-US")}`,
    style: new TextStyle({
      fill: 0x9aa3b2,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 18,
    }),
  });
  const prompt = new Text({
    text: "Press Space or click to return.",
    style: new TextStyle({
      fill: 0x9aa3b2,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 16,
    }),
  });

  overlay.addChild(dim, host, title, score, best, prompt);
  overlay.eventMode = "static";
  overlay.cursor = "pointer";
  overlay.on("pointertap", options.onReturn);
  overlay.layout = (width: number, height: number): void => {
    overlay.hitArea = new Rectangle(0, 0, width, height);
    dim.clear();
    dim.rect(0, 0, width, height);
    dim.fill({ color: 0x000000, alpha: 0.72 });

    const centerX = width / 2;
    const centerY = height / 2;

    host.anchor.set(0.5);
    host.position.set(centerX, centerY - 96);
    title.anchor.set(0.5);
    title.position.set(centerX, centerY - 56);
    score.anchor.set(0.5);
    score.position.set(centerX, centerY + 2);
    best.anchor.set(0.5);
    best.position.set(centerX, centerY + 42);
    prompt.anchor.set(0.5);
    prompt.position.set(centerX, centerY + 88);
  };

  return overlay;
}
