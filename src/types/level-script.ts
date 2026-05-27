// Single source of truth for the LinkWake level-script format.
// Bump SCHEMA_VERSION on any breaking change; readers must refuse other versions.

export const SCHEMA_VERSION = 1 as const;

export type Archetype =
  | "longform"
  | "reference"
  | "commerce"
  | "media"
  | "data"
  | "generic";

// Phase 0 only supports SURGE. Adding verbs is a Phase 2/3 concern.
export type Verb = "SURGE";

export type ViewportClass = "desktop" | "mobile";

export type FontClass =
  | "serif-heavy"
  | "sans-clean"
  | "display-loud"
  | "mono-tech"
  | "hand-irregular"
  | "corporate-cold";

export type ObstacleType = "paragraph" | "cta" | "ad" | "header" | "image";

export type WavePattern = "sine" | "random" | "alternating";

export type ChannelDrift = "left" | "right" | "center" | "oscillate";

// --- Acts (discriminated union on `kind`) ---

export type IntroAct = {
  t: number; // start time in ms from level start
  kind: "intro";
  duration: number; // ms
  payload: { title: string };
};

export type CalmAct = {
  t: number;
  kind: "calm";
  duration: number;
  payload: { density: number }; // 0..1
};

export type ObstacleWaveAct = {
  t: number;
  kind: "obstacle_wave";
  duration: number;
  payload: {
    pattern: WavePattern;
    density: number; // 0..1
    obstacle_type: ObstacleType;
  };
};

export type BurstAct = {
  t: number;
  kind: "burst";
  duration: number;
  payload: {
    density: number; // 0..1
    obstacle_type: ObstacleType;
  };
};

export type ChannelAct = {
  t: number;
  kind: "channel";
  duration: number;
  payload: {
    channel_width: number; // 0..1, fraction of playfield width
    drift: ChannelDrift;
  };
};

export type OutroAct = {
  t: number;
  kind: "outro";
  duration: number;
  payload: Record<string, never>; // intentionally empty
};

export type Act =
  | IntroAct
  | CalmAct
  | ObstacleWaveAct
  | BurstAct
  | ChannelAct
  | OutroAct;

export type ActKind = Act["kind"];

// --- Sub-structures ---

export type Scoring = {
  max_score: number;
  deductions: { hit: number; miss: number };
  bonuses: { perfect_section: number; no_hit_act: number };
};

export type Sensory = {
  /** At least 3 colors; lower-case `#rrggbb` hex strings only. */
  palette: string[];
  rhythm_bpm: number; // > 0
  font_class: FontClass;
};

export type SourceSignatures = {
  page_height_px: number;
  /** [x, y, width, height] in source-page pixel coords. */
  hero_box: [number, number, number, number];
  body_rhythm_hash: string;
};

// --- Top-level ---

export type LevelScript = {
  schema_version: typeof SCHEMA_VERSION;
  url_key: string; // canonical URL
  version_key: string; // sha256 hex (or "handauth_*" sentinel in Phase 0)
  lens_id: string; // Phase 0: always "canonical"
  viewport_class: ViewportClass;
  compiled_at: string; // ISO 8601 UTC
  archetype: Archetype;
  verb: Verb;
  duration_ms: number; // total level length
  rng_seed: string; // hex
  acts: Act[]; // sorted by t, non-overlapping, fitting inside duration_ms
  scoring: Scoring;
  sensory: Sensory;
  source_signatures: SourceSignatures;
};

export class LevelScriptValidationError extends Error {
  constructor(message: string, public readonly source: string) {
    super(`${source}: ${message}`);
    this.name = "LevelScriptValidationError";
  }
}

/**
 * Validates an unknown value against the LevelScript schema.
 * Throws LevelScriptValidationError on failure, with a path-qualified message.
 * Returns the input typed as LevelScript on success.
 *
 * `source` is a human-readable label (e.g. filename) used in errors.
 */
export function validateLevelScript(
  value: unknown,
  source: string,
): LevelScript {
  const fail = (message: string): never => {
    throw new LevelScriptValidationError(message, source);
  };

  const level = expectObject(value, "root", fail);

  expectExactKeys(level, "root", TOP_LEVEL_KEYS, fail);

  const schemaVersion = expectNumber(
    level.schema_version,
    "schema_version",
    fail,
  );

  if (schemaVersion !== SCHEMA_VERSION) {
    fail(
      `schema_version expected ${SCHEMA_VERSION}, received ${formatValue(
        schemaVersion,
      )}`,
    );
  }

  expectString(level.url_key, "url_key", fail);
  expectString(level.version_key, "version_key", fail);
  expectString(level.lens_id, "lens_id", fail);
  expectLiteral(
    level.viewport_class,
    "viewport_class",
    VIEWPORT_CLASSES,
    fail,
  );
  expectString(level.compiled_at, "compiled_at", fail);
  expectLiteral(level.archetype, "archetype", ARCHETYPES, fail);
  expectLiteral(level.verb, "verb", VERBS, fail);
  const durationMs = expectNonNegativeNumber(
    level.duration_ms,
    "duration_ms",
    fail,
  );
  expectHexString(level.rng_seed, "rng_seed", fail);

  const acts = expectArray(level.acts, "acts", fail).map((act, index) =>
    validateAct(act, `acts[${index}]`, fail),
  );

  validateActTiming(acts, durationMs, fail);
  validateScoring(level.scoring, fail);
  validateSensory(level.sensory, fail);
  validateSourceSignatures(level.source_signatures, fail);

  return value as LevelScript;
}

const TOP_LEVEL_KEYS = [
  "schema_version",
  "url_key",
  "version_key",
  "lens_id",
  "viewport_class",
  "compiled_at",
  "archetype",
  "verb",
  "duration_ms",
  "rng_seed",
  "acts",
  "scoring",
  "sensory",
  "source_signatures",
] as const;

const ARCHETYPES = [
  "longform",
  "reference",
  "commerce",
  "media",
  "data",
  "generic",
] as const satisfies readonly Archetype[];

const VERBS = ["SURGE"] as const satisfies readonly Verb[];
const VIEWPORT_CLASSES = [
  "desktop",
  "mobile",
] as const satisfies readonly ViewportClass[];
const FONT_CLASSES = [
  "serif-heavy",
  "sans-clean",
  "display-loud",
  "mono-tech",
  "hand-irregular",
  "corporate-cold",
] as const satisfies readonly FontClass[];
const OBSTACLE_TYPES = [
  "paragraph",
  "cta",
  "ad",
  "header",
  "image",
] as const satisfies readonly ObstacleType[];
const WAVE_PATTERNS = [
  "sine",
  "random",
  "alternating",
] as const satisfies readonly WavePattern[];
const CHANNEL_DRIFTS = [
  "left",
  "right",
  "center",
  "oscillate",
] as const satisfies readonly ChannelDrift[];

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;
const HEX_RE = /^[0-9a-f]+$/;

type Fail = (message: string) => never;
type JsonObject = Record<string, unknown>;

function validateAct(value: unknown, path: string, fail: Fail): Act {
  const act = expectObject(value, path, fail);

  expectNumber(act.t, `${path}.t`, fail);
  expectNonNegativeNumber(act.t, `${path}.t`, fail);
  expectNumber(act.duration, `${path}.duration`, fail);
  expectNonNegativeNumber(act.duration, `${path}.duration`, fail);

  if (typeof act.kind !== "string") {
    fail(`${path}.kind expected string, received ${formatValue(act.kind)}`);
  }

  switch (act.kind) {
    case "intro":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateIntroPayload(act.payload, `${path}.payload`, fail);
      break;
    case "calm":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateCalmPayload(act.payload, `${path}.payload`, fail);
      break;
    case "obstacle_wave":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateObstacleWavePayload(act.payload, `${path}.payload`, fail);
      break;
    case "burst":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateBurstPayload(act.payload, `${path}.payload`, fail);
      break;
    case "channel":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateChannelPayload(act.payload, `${path}.payload`, fail);
      break;
    case "outro":
      expectExactKeys(act, path, ["t", "kind", "duration", "payload"], fail);
      validateOutroPayload(act.payload, `${path}.payload`, fail);
      break;
    default:
      fail(`${path}.kind unknown act kind "${act.kind}"`);
  }

  return value as Act;
}

function validateIntroPayload(value: unknown, path: string, fail: Fail): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(payload, path, ["title"], fail);
  expectString(payload.title, `${path}.title`, fail);
}

function validateCalmPayload(value: unknown, path: string, fail: Fail): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(payload, path, ["density"], fail);
  expectUnitNumber(payload.density, `${path}.density`, fail);
}

function validateObstacleWavePayload(
  value: unknown,
  path: string,
  fail: Fail,
): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(
    payload,
    path,
    ["pattern", "density", "obstacle_type"],
    fail,
  );
  expectLiteral(payload.pattern, `${path}.pattern`, WAVE_PATTERNS, fail);
  expectUnitNumber(payload.density, `${path}.density`, fail);
  expectLiteral(
    payload.obstacle_type,
    `${path}.obstacle_type`,
    OBSTACLE_TYPES,
    fail,
  );
}

function validateBurstPayload(value: unknown, path: string, fail: Fail): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(payload, path, ["density", "obstacle_type"], fail);
  expectUnitNumber(payload.density, `${path}.density`, fail);
  expectLiteral(
    payload.obstacle_type,
    `${path}.obstacle_type`,
    OBSTACLE_TYPES,
    fail,
  );
}

function validateChannelPayload(value: unknown, path: string, fail: Fail): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(payload, path, ["channel_width", "drift"], fail);
  expectUnitNumber(payload.channel_width, `${path}.channel_width`, fail);
  expectLiteral(payload.drift, `${path}.drift`, CHANNEL_DRIFTS, fail);
}

function validateOutroPayload(value: unknown, path: string, fail: Fail): void {
  const payload = expectObject(value, path, fail);

  expectExactKeys(payload, path, [], fail);
}

function validateActTiming(
  acts: readonly Act[],
  durationMs: number,
  fail: Fail,
): void {
  for (let index = 0; index < acts.length; index += 1) {
    const act = acts[index];

    if (!act) {
      fail(`acts[${index}] missing act`);
    }

    if (act.t + act.duration > durationMs) {
      fail(
        `acts[${index}] ends at ${act.t + act.duration}, beyond duration_ms ${durationMs}`,
      );
    }

    const nextAct = acts[index + 1];

    if (!nextAct) {
      continue;
    }

    if (act.t > nextAct.t) {
      fail(
        `acts[${index + 1}].t must be sorted ascending; received ${nextAct.t} after ${act.t}`,
      );
    }

    if (act.t + act.duration > nextAct.t) {
      fail(
        `acts[${index}] overlaps acts[${index + 1}]; ${act.t} + ${act.duration} > ${nextAct.t}`,
      );
    }
  }
}

function validateScoring(value: unknown, fail: Fail): void {
  const scoring = expectObject(value, "scoring", fail);

  expectExactKeys(scoring, "scoring", ["max_score", "deductions", "bonuses"], fail);
  expectNonNegativeNumber(scoring.max_score, "scoring.max_score", fail);

  const deductions = expectObject(
    scoring.deductions,
    "scoring.deductions",
    fail,
  );

  expectExactKeys(deductions, "scoring.deductions", ["hit", "miss"], fail);
  expectNonNegativeNumber(deductions.hit, "scoring.deductions.hit", fail);
  expectNonNegativeNumber(deductions.miss, "scoring.deductions.miss", fail);

  const bonuses = expectObject(scoring.bonuses, "scoring.bonuses", fail);

  expectExactKeys(
    bonuses,
    "scoring.bonuses",
    ["perfect_section", "no_hit_act"],
    fail,
  );
  expectNonNegativeNumber(
    bonuses.perfect_section,
    "scoring.bonuses.perfect_section",
    fail,
  );
  expectNonNegativeNumber(
    bonuses.no_hit_act,
    "scoring.bonuses.no_hit_act",
    fail,
  );
}

function validateSensory(value: unknown, fail: Fail): void {
  const sensory = expectObject(value, "sensory", fail);

  expectExactKeys(sensory, "sensory", ["palette", "rhythm_bpm", "font_class"], fail);

  const palette = expectArray(sensory.palette, "sensory.palette", fail);

  if (palette.length < 3) {
    fail(`sensory.palette expected at least 3 colors, received ${palette.length}`);
  }

  palette.forEach((color, index) => {
    const path = `sensory.palette[${index}]`;
    const hex = expectString(color, path, fail);

    if (!HEX_COLOR_RE.test(hex)) {
      fail(`${path} expected lower-case #rrggbb hex color, received ${formatValue(hex)}`);
    }
  });

  const rhythmBpm = expectNumber(sensory.rhythm_bpm, "sensory.rhythm_bpm", fail);

  if (rhythmBpm <= 0) {
    fail(`sensory.rhythm_bpm expected > 0, received ${rhythmBpm}`);
  }

  expectLiteral(sensory.font_class, "sensory.font_class", FONT_CLASSES, fail);
}

function validateSourceSignatures(value: unknown, fail: Fail): void {
  const signatures = expectObject(value, "source_signatures", fail);

  expectExactKeys(
    signatures,
    "source_signatures",
    ["page_height_px", "hero_box", "body_rhythm_hash"],
    fail,
  );
  expectNonNegativeNumber(
    signatures.page_height_px,
    "source_signatures.page_height_px",
    fail,
  );

  const heroBox = expectArray(
    signatures.hero_box,
    "source_signatures.hero_box",
    fail,
  );

  if (heroBox.length !== 4) {
    fail(
      `source_signatures.hero_box expected 4 numbers, received ${heroBox.length}`,
    );
  }

  heroBox.forEach((valueAtIndex, index) => {
    expectNonNegativeNumber(
      valueAtIndex,
      `source_signatures.hero_box[${index}]`,
      fail,
    );
  });
  expectString(
    signatures.body_rhythm_hash,
    "source_signatures.body_rhythm_hash",
    fail,
  );
}

function expectObject(value: unknown, path: string, fail: Fail): JsonObject {
  if (!isPlainObject(value)) {
    fail(`${path} expected object, received ${formatValue(value)}`);
  }

  return value;
}

function expectArray(value: unknown, path: string, fail: Fail): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${path} expected array, received ${formatValue(value)}`);
  }

  return value;
}

function expectString(value: unknown, path: string, fail: Fail): string {
  if (typeof value !== "string") {
    fail(`${path} expected string, received ${formatValue(value)}`);
  }

  if (value.length === 0) {
    fail(`${path} expected non-empty string`);
  }

  return value;
}

function expectHexString(value: unknown, path: string, fail: Fail): string {
  const hex = expectString(value, path, fail);

  if (!HEX_RE.test(hex)) {
    fail(`${path} expected lower-case hex string, received ${formatValue(hex)}`);
  }

  return hex;
}

function expectNumber(value: unknown, path: string, fail: Fail): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${path} expected finite number, received ${formatValue(value)}`);
  }

  return value;
}

function expectNonNegativeNumber(
  value: unknown,
  path: string,
  fail: Fail,
): number {
  const numberValue = expectNumber(value, path, fail);

  if (numberValue < 0) {
    fail(`${path} expected non-negative number, received ${numberValue}`);
  }

  return numberValue;
}

function expectUnitNumber(value: unknown, path: string, fail: Fail): number {
  const numberValue = expectNumber(value, path, fail);

  if (numberValue < 0 || numberValue > 1) {
    fail(`${path} expected number in [0, 1], received ${numberValue}`);
  }

  return numberValue;
}

function expectLiteral<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  fail: Fail,
): T {
  if (typeof value !== "string") {
    fail(`${path} expected string, received ${formatValue(value)}`);
  }

  if (!allowed.includes(value as T)) {
    fail(
      `${path} expected one of ${allowed.map((item) => `"${item}"`).join(", ")}, received ${formatValue(value)}`,
    );
  }

  return value as T;
}

function expectExactKeys(
  value: JsonObject,
  path: string,
  expectedKeys: readonly string[],
  fail: Fail,
): void {
  const expected = new Set(expectedKeys);
  const actualKeys = Object.keys(value);

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      fail(`${path}.${key} is required`);
    }
  }

  for (const key of actualKeys) {
    if (!expected.has(key)) {
      fail(`${path}.${key} is not allowed`);
    }
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}
