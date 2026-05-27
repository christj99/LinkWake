import {
  autoDetectRenderer,
  Container,
  Graphics,
  Rectangle,
  RendererType,
  Text,
  TextStyle,
  Ticker,
} from "pixi.js";
import { GameRuntime, type RuntimeState } from "./game/runtime";
import { LEVELS } from "./levels";
import { createResultsOverlay, type ResultsOverlay } from "./shell/results-overlay";
import "./styles/shell.css";

import type { FontClass, LevelScript } from "./types/level-script";

const BACKGROUND = 0x050505;
const WHITE = 0xf5f7fb;
const MUTED = 0x9aa3b2;
const CARD_BORDER = 0x20242d;

const FONT_FAMILIES: Record<FontClass, string> = {
  "serif-heavy": "Georgia, 'Times New Roman', serif",
  "sans-clean": "Inter, system-ui, sans-serif",
  "display-loud": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  "mono-tech": "'Cascadia Code', Consolas, monospace",
  "hand-irregular": "'Segoe Print', 'Bradley Hand ITC', cursive",
  "corporate-cold": "Arial, Helvetica, sans-serif",
};

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app mount point.");
}

const appRootElement = appRoot;

const renderer = await autoDetectRenderer({
  preference: "webgpu",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: BACKGROUND,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
});

appRoot.appendChild(renderer.canvas);

const stage = new Container();
const previewLayer = new Container();
const header = new Text({
  text: "LinkWake Phase 0 Levels",
  style: new TextStyle({
    fill: WHITE,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 30,
    fontWeight: "700",
  }),
});
const rendererStatus = new Text({
  text: `PixiJS renderer ready: ${
    renderer.type === RendererType.WEBGPU ? "WebGPU" : "WebGL"
  }`,
  style: new TextStyle({
    fill: MUTED,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 15,
  }),
});
const tiles: LevelTile[] = LEVELS.map((level) => createLevelTile(level));

let runtime: GameRuntime | null = null;
let runtimeState: RuntimeState = { kind: "preview" };
let resultsOverlay: ResultsOverlay | null = null;

previewLayer.addChild(header, rendererStatus, ...tiles);
stage.addChild(previewLayer);

function layout(): void {
  renderer.resize(window.innerWidth, window.innerHeight);

  const viewportWidth = window.innerWidth;
  const tileWidth = Math.min(760, Math.max(300, viewportWidth - 48));
  const tileHeight = 138;
  const gap = 18;
  const contentHeight = 68 + tiles.length * tileHeight + (tiles.length - 1) * gap;
  const startY = Math.max(28, (window.innerHeight - contentHeight) / 2);
  const x = (viewportWidth - tileWidth) / 2;

  header.anchor.set(0, 0);
  header.position.set(x, startY);

  rendererStatus.anchor.set(0, 0);
  rendererStatus.position.set(x, startY + 38);

  tiles.forEach((tile, index) => {
    tile.position.set(x, startY + 68 + index * (tileHeight + gap));
    tile.hitArea = new Rectangle(0, 0, tileWidth, tileHeight);
    drawLevelTile(tile, LEVELS[index], tileWidth, tileHeight);
  });

  resultsOverlay?.layout(window.innerWidth, window.innerHeight);
}

function createLevelTile(level: LevelScript): LevelTile {
  const tile = new Container() as LevelTile;
  const background = new Graphics();
  const host = new Text({
    text: hostFromUrl(level.url_key),
    style: new TextStyle({
      fill: readableHostColor(level),
      fontFamily: FONT_FAMILIES[level.sensory.font_class],
      fontSize: 26,
      fontWeight: "700",
    }),
  });
  const archetype = new Text({
    text: level.archetype,
    style: new TextStyle({
      fill: MUTED,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 14,
      fontWeight: "700",
    }),
  });
  const subtitle = new Text({
    text: `${level.acts.length} acts - ${level.verb}`,
    style: new TextStyle({
      fill: WHITE,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 15,
    }),
  });

  tile.level = level;
  tile.background = background;
  tile.host = host;
  tile.archetype = archetype;
  tile.subtitle = subtitle;
  tile.eventMode = "static";
  tile.cursor = "pointer";
  tile.on("pointertap", () => startRun(level));
  tile.addChild(background, host, archetype, subtitle);

  return tile;
}

function drawLevelTile(
  tile: LevelTile,
  level: LevelScript | undefined,
  width: number,
  height: number,
): void {
  if (!level) {
    return;
  }

  const { archetype, background, host, subtitle } = tile;

  background.clear();
  background.roundRect(0, 0, width, height, 8);
  background.fill({ color: 0x0b0d10 });
  background.roundRect(0.5, 0.5, width - 1, height - 1, 8);
  background.stroke({ color: CARD_BORDER, alpha: 1, width: 1 });
  background.rect(0, 0, 10, height);
  background.fill({ color: colorNumber(paletteColor(level, 2)), alpha: 0.92 });

  host.position.set(28, 22);
  archetype.position.set(28, 62);
  subtitle.position.set(28, 92);

  drawSwatches(background, level.sensory.palette, width);
}

function startRun(level: LevelScript): void {
  runtime?.destroy();
  runtime = new GameRuntime({
    level,
    canvas: renderer.canvas,
    stage,
  });
  runtimeState = {
    kind: "playing",
    level,
    elapsedMs: 0,
    score: level.scoring.max_score,
  };
  previewLayer.visible = false;
  destroyResultsOverlay();
  appRootElement.classList.remove("is-preview");
}

function showResults(state: Extract<RuntimeState, { kind: "ended" }>): void {
  runtimeState = state;
  destroyResultsOverlay();
  resultsOverlay = createResultsOverlay({
    level: state.level,
    score: state.score,
    bestScore: state.bestScore,
    onReturn: showPreview,
  });
  stage.addChild(resultsOverlay);
  resultsOverlay.layout(window.innerWidth, window.innerHeight);
}

function showPreview(): void {
  runtime?.destroy();
  runtime = null;
  runtimeState = { kind: "preview" };
  destroyResultsOverlay();
  previewLayer.visible = true;
  appRootElement.classList.add("is-preview");
}

function destroyResultsOverlay(): void {
  if (!resultsOverlay) {
    return;
  }

  stage.removeChild(resultsOverlay);
  resultsOverlay.destroy({ children: true });
  resultsOverlay = null;
}

function drawSwatches(
  graphics: Graphics,
  palette: readonly string[],
  tileWidth: number,
): void {
  const swatchSize = 18;
  const swatchGap = 8;
  const totalWidth =
    palette.length * swatchSize + Math.max(0, palette.length - 1) * swatchGap;
  const startX = tileWidth - totalWidth - 28;

  palette.forEach((color, index) => {
    const x = startX + index * (swatchSize + swatchGap);

    graphics.roundRect(x, 92, swatchSize, swatchSize, 4);
    graphics.fill({ color: colorNumber(color) });
    graphics.roundRect(x + 0.5, 92.5, swatchSize - 1, swatchSize - 1, 4);
    graphics.stroke({ color: WHITE, alpha: 0.24, width: 1 });
  });
}

function paletteColor(level: LevelScript, index: number): string {
  const color =
    level.sensory.palette[index] ??
    level.sensory.palette[level.sensory.palette.length - 1];

  if (!color) {
    throw new Error(`Missing palette color ${index} for ${level.url_key}`);
  }

  return color;
}

function readableHostColor(level: LevelScript): number {
  const candidate = paletteColor(level, 0);
  const tileBackground = "#0b0d10";

  if (relativeLuminance(candidate) < 0.5 && relativeLuminance(tileBackground) < 0.5) {
    return 0xe6e8ee;
  }

  return colorNumber(candidate);
}

function colorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function relativeLuminance(hex: string): number {
  const value = colorNumber(hex);
  const red = channelLuminance((value >> 16) & 255);
  const green = channelLuminance((value >> 8) & 255);
  const blue = channelLuminance(value & 255);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function channelLuminance(channel: number): number {
  const normalized = channel / 255;

  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hostFromUrl(url: string): string {
  return new URL(url).host;
}

layout();
showPreview();
window.addEventListener("resize", layout);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && runtimeState.kind === "playing") {
    if (runtime) {
      showResults(runtime.finish());
    }
  } else if (
    (event.key === "Escape" || event.key === " ") &&
    runtimeState.kind === "ended"
  ) {
    event.preventDefault();
    showPreview();
  }
});

Ticker.shared.add(() => {
  if (runtimeState.kind === "playing" && runtime) {
    const nextState = runtime.update(Ticker.shared.deltaMS);

    if (nextState.kind === "ended") {
      showResults(nextState);
    } else {
      runtimeState = nextState;
    }
  }

  renderer.render(stage);
});
Ticker.shared.start();

type LevelTile = Container & {
  archetype: Text;
  background: Graphics;
  host: Text;
  level: LevelScript;
  subtitle: Text;
};
