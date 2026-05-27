export type PlayfieldMetrics = {
  virtualWidth: number;
  virtualHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

type InputSource = "keyboard" | "pointer";

export type InputControllerOptions = {
  canvas: HTMLCanvasElement;
  getMetrics: () => PlayfieldMetrics;
  initialPlayerX: number;
  keyboardSpeed?: number;
  minX?: number;
  maxX?: number;
};

export class InputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly getMetrics: () => PlayfieldMetrics;
  private readonly keyboardSpeed: number;
  private readonly minX: number;
  private readonly maxX: number;
  private keys = new Set<string>();
  private lastSource: InputSource = "keyboard";
  private pointerX: number;

  constructor(options: InputControllerOptions) {
    this.canvas = options.canvas;
    this.getMetrics = options.getMetrics;
    this.keyboardSpeed = options.keyboardSpeed ?? 320;
    this.minX = options.minX ?? 16;
    this.maxX = options.maxX ?? 464;
    this.pointerX = options.initialPlayerX;

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerMove);
  }

  update(deltaSeconds: number, currentX: number): number {
    if (this.lastSource === "pointer") {
      return clamp(this.pointerX, this.minX, this.maxX);
    }

    const direction = this.keyboardDirection();

    if (direction === 0) {
      return clamp(currentX, this.minX, this.maxX);
    }

      return clamp(
      currentX + direction * this.keyboardSpeed * deltaSeconds,
      this.minX,
      this.maxX,
    );
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerMove);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!isMovementKey(event.key)) {
      return;
    }

    event.preventDefault();
    this.keys.add(normalizeKey(event.key));
    this.lastSource = "keyboard";
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!isMovementKey(event.key)) {
      return;
    }

    event.preventDefault();
    this.keys.delete(normalizeKey(event.key));
    this.lastSource = "keyboard";
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerX = this.clientXToVirtualX(event.clientX);
    this.lastSource = "pointer";
  };

  private keyboardDirection(): number {
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");

    if (left === right) {
      return 0;
    }

    return left ? -1 : 1;
  }

  private clientXToVirtualX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.getMetrics();
    const canvasX = clientX - rect.left;
    const virtualX = (canvasX - metrics.offsetX) / metrics.scale;

    return clamp(virtualX, this.minX, this.maxX);
  }
}

function isMovementKey(key: string): boolean {
  const normalized = normalizeKey(key);

  return (
    normalized === "arrowleft" ||
    normalized === "arrowright" ||
    normalized === "a" ||
    normalized === "d"
  );
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
