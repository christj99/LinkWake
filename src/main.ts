import {
  autoDetectRenderer,
  Container,
  Graphics,
  RendererType,
  Text,
  TextStyle,
  Ticker,
} from "pixi.js";
import "./styles/shell.css";

const BACKGROUND = 0x050505;
const CYAN = 0x00d7ff;
const WHITE = 0xf5f7fb;
const MUTED = 0x9aa3b2;

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app mount point.");
}

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
const wordmark = new Text({
  text: "LinkWake",
  style: new TextStyle({
    fill: WHITE,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 56,
    fontWeight: "700",
  }),
});
const status = new Text({
  text: `PixiJS renderer ready: ${
    renderer.type === RendererType.WEBGPU ? "WebGPU" : "WebGL"
  }`,
  style: new TextStyle({
    fill: MUTED,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 18,
  }),
});
const pulse = new Graphics();

stage.addChild(pulse, wordmark, status);

function layout(): void {
  renderer.resize(window.innerWidth, window.innerHeight);

  wordmark.anchor.set(0.5);
  wordmark.position.set(window.innerWidth / 2, window.innerHeight / 2 - 28);

  status.anchor.set(0.5);
  status.position.set(window.innerWidth / 2, window.innerHeight / 2 + 34);
}

function drawPulse(elapsedMs: number): void {
  const radius = 70 + Math.sin(elapsedMs / 700) * 8;
  const alpha = 0.26 + Math.sin(elapsedMs / 900) * 0.07;

  pulse.clear();
  pulse.circle(window.innerWidth / 2, window.innerHeight / 2, radius);
  pulse.stroke({ color: CYAN, alpha, width: 3 });
}

layout();
window.addEventListener("resize", layout);

const startedAt = performance.now();
Ticker.shared.add(() => {
  drawPulse(performance.now() - startedAt);
  renderer.render(stage);
});
Ticker.shared.start();
