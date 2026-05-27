# LinkWake — Phase 0, Checkpoint 2: Schema lock + level files

## Reading order

Before writing code, read in this order:

1. `webwave_form_maturity_bible_v0_1.md` §6 (The Level Compiler) and §9 (URL Identity, Versioning, Fairness) — defines *why* the schema exists and what it has to support at maturity.
2. `webwave_technical_plan_v0_1.md` Phase 1 — defines the schema's downstream consumer. The Compiler that Phase 1 builds will *emit* exactly the shape we hand-author here.
3. The current `src/` tree — see what checkpoint 1 built so this checkpoint composes cleanly.

Checkpoint 1 already shipped: scaffolding, PixiJS rendering, repo public on GitHub. This brief is just checkpoint 2.

## What this checkpoint proves

The level-script schema is the load-bearing contract between every future part of LinkWake — Phase 0's hand-authored levels, Phase 1's Compiler, Phase 2's backend, Phase 4's extension, and Phase 8's Lens system all read and write this shape. **The single most important thing this checkpoint accomplishes is locking that schema in.** If it's wrong here, every later phase pays a tax.

By the end of checkpoint 2:

- The schema exists as exhaustive TypeScript types in `src/types/level-script.ts`.
- A runtime validator in the same file checks unknown JSON against those types and throws with precise, debuggable errors.
- Three placeholder level JSONs live in `src/levels/`, each demonstrating every act `kind`, so the SURGE runtime in checkpoint 3 has working test data on day one.
- The PixiJS canvas displays a non-interactive three-tile preview confirming the levels loaded and validated.

## Pre-flight fixes from checkpoint 1

Roll these in *before* the schema work, as a separate commit:

1. **Fix renderer detection in `src/main.ts`.** Replace the `describeRenderer` helper with a direct check against `RendererType`:

   ```ts
   import { RendererType } from "pixi.js";
   // ...
   const rendererLabel =
     renderer.type === RendererType.WEBGPU ? "WebGPU" : "WebGL";
   ```

   Delete the `describeRenderer` function entirely.

2. **Tighten `tsconfig.json` under `compilerOptions`:**

   ```json
   "noUncheckedIndexedAccess": true,
   "noImplicitOverride": true
   ```

   Run `npm run build`. If newly surfaced `T | undefined` errors appear, fix them properly — do not soften either flag.

3. **Add explicit head tags to `index.html`** for assets already committed in `public/`:

   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   <meta property="og:title" content="LinkWake" />
   <meta property="og:image" content="/og-image.svg" />
   ```

Commit these together as `phase0/chore: fold checkpoint 1 review fixes`.

## The schema (lock this)

Create `src/types/level-script.ts`. **The TypeScript below is normative.** Every field, every literal, every constraint is intentional. Do not deviate without flagging first.

```ts
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
  t: number;            // start time in ms from level start
  kind: "intro";
  duration: number;     // ms
  payload: { title: string };
};

export type CalmAct = {
  t: number;
  kind: "calm";
  duration: number;
  payload: { density: number };   // 0..1
};

export type ObstacleWaveAct = {
  t: number;
  kind: "obstacle_wave";
  duration: number;
  payload: {
    pattern: WavePattern;
    density: number;              // 0..1
    obstacle_type: ObstacleType;
  };
};

export type BurstAct = {
  t: number;
  kind: "burst";
  duration: number;
  payload: {
    density: number;              // 0..1
    obstacle_type: ObstacleType;
  };
};

export type ChannelAct = {
  t: number;
  kind: "channel";
  duration: number;
  payload: {
    channel_width: number;        // 0..1, fraction of playfield width
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
  rhythm_bpm: number;             // > 0
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
  url_key: string;                // canonical URL
  version_key: string;            // sha256 hex (or "handauth_*" sentinel in Phase 0)
  lens_id: string;                // Phase 0: always "canonical"
  viewport_class: ViewportClass;
  compiled_at: string;            // ISO 8601 UTC
  archetype: Archetype;
  verb: Verb;
  duration_ms: number;            // total level length
  rng_seed: string;               // hex
  acts: Act[];                    // sorted by t, non-overlapping, fitting inside duration_ms
  scoring: Scoring;
  sensory: Sensory;
  source_signatures: SourceSignatures;
};
```

## The validator

Same file, exported alongside the types:

```ts
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
): LevelScript;
```

**Hand-roll the implementation.** Do not add Zod, Valibot, Arktype, or any other schema library. Three reasons:

1. Phase 0's dependency surface is locked at `pixi.js`, `howler`, plus dev tooling. Adding a runtime schema lib is a Phase 1 conversation — the Compiler will need it; Phase 0 doesn't.
2. The schema is small enough to validate by hand. Reach for a library when the surface justifies it, not before.
3. Hand-rolling forces you to internalize every constraint, which matters because every later phase will read this code as the spec.

Validator requirements:

- Walk the structure top-down, accumulating a JSON-pointer-style path (`acts[3].payload.density`) so errors are pinpoint.
- Refuse unknown act kinds with the offending kind quoted in the message.
- Refuse `schema_version !== 1` with a message naming both expected and actual values.
- Refuse `palette.length < 3`.
- Refuse `rhythm_bpm <= 0`.
- Refuse hex colors not matching `/^#[0-9a-f]{6}$/`.
- Refuse negative numbers anywhere a non-negative is expected (`t`, `duration`, `duration_ms`, `max_score`, `page_height_px`).
- Refuse `density` or `channel_width` outside `[0, 1]`.
- **Refuse acts not sorted by `t` ascending.** Sort order is part of the contract.
- **Refuse acts where `t + duration > duration_ms`.**
- **Refuse acts that overlap** — `acts[i].t + acts[i].duration > acts[i+1].t`. Acts are sequential, not concurrent.
- Refuse missing or extra top-level fields. (Tolerating extras hides bugs; new fields go through a `schema_version` bump.)

Throw on the first error you find. No error aggregation — keep the validator small.

## Level files

Create three JSON files in `src/levels/`. Each demonstrates **every act kind exactly once**, in this order:

| # | kind            | `t`    | `duration` | ends at |
|---|-----------------|--------|------------|---------|
| 1 | `intro`         | 0      | 2000       | 2000    |
| 2 | `calm`          | 2000   | 4000       | 6000    |
| 3 | `obstacle_wave` | 6000   | 8000       | 14000   |
| 4 | `burst`         | 14000  | 3000       | 17000   |
| 5 | `channel`       | 17000  | 6000       | 23000   |
| 6 | `obstacle_wave` | 23000  | 15000      | 38000   |
| 7 | `outro`         | 38000  | 7000       | 45000   |

Total `duration_ms`: `45000`.

These are intentionally placeholder content; I'll hand-edit them later. What matters now is that they validate, and that each archetype gets distinctive sensory metadata so the three preview tiles look visibly different.

### `src/levels/longform-nyt.json`

Longform archetype. Serif-heavy. Restrained palette (deep ink + paper + a single accent).

- `url_key`: `"https://www.nytimes.com/example/article-slug"`
- `version_key`: `"handauth_longform_v1"`
- `lens_id`: `"canonical"`
- `viewport_class`: `"desktop"`
- `compiled_at`: `"2026-05-27T00:00:00Z"`
- `archetype`: `"longform"`
- `verb`: `"SURGE"`
- `rng_seed`: `"0000000000deadbeef"`
- Act 2 (`calm`): density `0.15`
- Act 3 (`obstacle_wave`): pattern `"sine"`, density `0.5`, obstacle_type `"paragraph"`
- Act 4 (`burst`): density `0.9`, obstacle_type `"cta"`
- Act 5 (`channel`): channel_width `0.3`, drift `"oscillate"`
- Act 6 (`obstacle_wave`): pattern `"random"`, density `0.6`, obstacle_type `"ad"`
- `scoring`: `{ max_score: 10000, deductions: { hit: 100, miss: 50 }, bonuses: { perfect_section: 500, no_hit_act: 250 } }`
- `sensory.palette`: `["#1a1a1a", "#f3eee6", "#bb2222"]`
- `sensory.rhythm_bpm`: `96`
- `sensory.font_class`: `"serif-heavy"`
- `source_signatures`: `{ page_height_px: 8420, hero_box: [120, 80, 800, 500], body_rhythm_hash: "placeholder-longform" }`

### `src/levels/reference-wikipedia.json`

Reference archetype. Sans-clean. Neutral cool palette.

Same shape as the longform file, with these differences:

- `url_key`: `"https://en.wikipedia.org/wiki/Example"`
- `version_key`: `"handauth_reference_v1"`
- `archetype`: `"reference"`
- `sensory.palette`: `["#202122", "#f8f9fa", "#3366cc"]`
- `sensory.rhythm_bpm`: `84`
- `sensory.font_class`: `"sans-clean"`
- `source_signatures.body_rhythm_hash`: `"placeholder-reference"`
- Vary the obstacle waves a touch — e.g. first `obstacle_wave` uses pattern `"alternating"` with density `0.4`, obstacle_type `"header"`. Second `obstacle_wave` uses pattern `"sine"`, density `0.5`, obstacle_type `"paragraph"`. Keep the structural shape identical.

### `src/levels/commerce-amazon.json`

Commerce archetype. Display-loud. Saturated warm palette.

- `url_key`: `"https://www.amazon.com/dp/EXAMPLEASIN"`
- `version_key`: `"handauth_commerce_v1"`
- `archetype`: `"commerce"`
- `sensory.palette`: `["#0f1111", "#ffd814", "#ff9900", "#cc0c39"]`
- `sensory.rhythm_bpm`: `120`
- `sensory.font_class`: `"display-loud"`
- `source_signatures.body_rhythm_hash`: `"placeholder-commerce"`
- Bias obstacle types toward `"cta"` and `"image"`. First `obstacle_wave` uses pattern `"random"`, density `0.65`, obstacle_type `"cta"`. `burst` uses density `0.95`, obstacle_type `"image"`. Second `obstacle_wave` uses pattern `"sine"`, density `0.7`, obstacle_type `"cta"`.

## Levels loader

Create `src/levels/index.ts`:

```ts
import type { LevelScript } from "../types/level-script";
import { validateLevelScript } from "../types/level-script";

import longformNyt from "./longform-nyt.json";
import referenceWikipedia from "./reference-wikipedia.json";
import commerceAmazon from "./commerce-amazon.json";

/**
 * All Phase 0 levels, validated at module load.
 * Throws LevelScriptValidationError synchronously if any file is malformed.
 */
export const LEVELS: readonly LevelScript[] = Object.freeze([
  validateLevelScript(longformNyt, "longform-nyt.json"),
  validateLevelScript(referenceWikipedia, "reference-wikipedia.json"),
  validateLevelScript(commerceAmazon, "commerce-amazon.json"),
]);
```

Vite supports JSON imports natively; `resolveJsonModule` is already on.

## Three-tile preview (replaces the splash from checkpoint 1)

Update `src/main.ts` so the canvas shows three stacked tiles — one per loaded level — instead of the wordmark + cyan pulse. Stay inside PixiJS primitives (`Container`, `Graphics`, `Text`). **Do not** add HTML/DOM UI, do not import Howler, do not start the SURGE runtime.

Each tile shows:

- The level's host, parsed from `url_key`, drawn in `palette[0]`, using a font-family chosen from a small dictionary you create at the top of `main.ts` mapping `FontClass → string` (e.g. `"serif-heavy"` → `"Georgia, 'Times New Roman', serif"`, `"sans-clean"` → `"Inter, system-ui, sans-serif"`, etc.). Pick reasonable system fonts. We'll refine the mapping in later phases.
- A small horizontal row of color swatches, one rectangle per palette entry, in palette order.
- The archetype as a small label.
- `acts.length` and the verb (`SURGE`) as a single subtitle line.

Tiles are non-interactive. Hover and click are checkpoint 3.

If `LEVELS` fails to validate at import time, the thrown `LevelScriptValidationError` should bubble up and crash the page — the document body will be blank with the error in the console. That's correct. The validator is the safety net, not the UI.

## Exit criteria

- `npm run build` completes with zero errors and zero warnings.
- All three level JSONs validate. Three visibly distinct tiles render on screen (different palettes, different font feels).
- **Adversarial check (do this manually, then revert):** deliberately break one level file — e.g. set `palette` to `[]`, or set act 3's `t` to `5000` so it overlaps act 2. Confirm the validator throws with a message that names the file and the offending field. Revert the break before committing.
- Bundle gzipped still under 300KB (check `npm run build` output).
- `CHANGELOG.md` has a checkpoint-2 entry, same brief style as the checkpoint-1 entry.

## What's out of scope (still)

- The SURGE runtime. Acts drive no gameplay yet; that is checkpoint 3.
- Audio. Howler stays unimported.
- Sharing / emoji grid. That is checkpoint 5.
- Real input handling — no keyboard, mouse, or touch beyond what PixiJS does internally for rendering.
- A real level selector (clickable, routable). The three tiles are display-only.
- Schema versioning beyond v1. There's only one version.
- Server, accounts, leaderboard — all explicitly Phase 2 and later.

## Working norms

- Commit messages: `phase0/<area>: <imperative summary>`. Likely areas for this checkpoint: `chore` (the pre-flight fixes), `schema`, `levels`, `loader`, `preview`.
- Commit the pre-flight fixes first, push, then start the schema. Then commit the schema in isolation — it's the contract everything hangs on and I want it reviewable as its own atom.
- Update `CHANGELOG.md` once at the end of the checkpoint with a single paragraph.
- If anything in this brief contradicts the bible or the tech plan, flag it before resolving. The bible is canonical product truth, the tech plan is canonical technical truth, this brief is canonical scope truth for checkpoint 2.

When done: push, stop, and tell me. I'll review and write the checkpoint 3 brief (SURGE runtime — finally interactive).
