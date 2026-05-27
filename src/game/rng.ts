export type RandomSource = {
  next: () => number;
  uniform: (min: number, max: number) => number;
};

export function seedFromHex(hex: string): number {
  const seedText = hex.slice(0, 8).padEnd(8, "0");
  const seed = Number.parseInt(seedText, 16);

  if (!Number.isFinite(seed)) {
    throw new Error(`Invalid hex seed: ${hex}`);
  }

  return seed >>> 0;
}

export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;

    let mixed = state;

    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    uniform: (min: number, max: number): number => min + next() * (max - min),
  };
}

