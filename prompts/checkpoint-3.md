# LinkWake — Phase 0, Checkpoint 3: SURGE runtime — first interactive build

## Reading order

Before writing code, read in this order:

1. `webwave_form_maturity_bible_v0_1.md` §7.1 (design rule for every verb) and §7.2 (SURGE) — defines what SURGE is *for* at maturity. We're building a Phase 0 sliver of that vision.
2. `webwave_technical_plan_v0_1.md` Phase 0 — the "is this fun?" gate is what this checkpoint exists to test.
3. `prompts/checkpoint-2.md` — what's already in the repo. The schema and level files are now the contract you're reading from.
4. `src/types/level-script.ts` — every gameplay parameter you'll touch lives here.

## What this checkpoint proves

This is the fun-yield test. From the tech plan: *"If after 14 days the page-as-level concept doesn't make you want to play your own builds, no amount of infrastructure will save the product."* That test fires here.

By the end of checkpoint 3:

- Clicking a tile starts a real SURGE run on that level.
- A player avatar dodges obstacles spawned from the level's `obstacle_wave` acts.
- Collisions deduct score per the level's `scoring.deductions.hit`.
- The run ends at `duration_ms`, shows a results overlay, and persists best score per URL to localStorage.
- Escape (or a back action) returns to the three-tile preview.

The "is this fun?" judgement is mine, not Codex's. **Codex's job is to ship the runtime cleanly. Mine is to play it five times and decide whether Phase 0 advances or pivots.** Codex Desktop's sandboxed browser apparently can't open localhost reliably — that's fine; ship the build and I'll run it in real Chrome.

## Scope (intentionally narrow)

Active act kinds: **`calm` and `obstacle_wave` only.**

All other act kinds (`intro`, `burst`, `channel`, `outro`) are scheduled by the runtime but spawn nothing — their `duration` advances the act timer and nothing else. Checkpoint 4 wires them up. This narrowing is deliberate: if SURGE is fun with just two act kinds firing, it's fun. If it's not, more variety won't save it.

## Pre-flight chore commit (do first, separate commit)

Bring `README.md` in line with reality. It still says checkpoint 1. One paragraph that names the current state (schema locked, three placeholder levels, tile preview, SURGE in progress) is enough. Commit as `phase0/chore: refresh README to current state`.

While you're there, deduplicate the validator's `expectNumber` → `expectNonNegativeNumber` pairs in `validateAct` — the second already calls the first. Cosmetic, but the validator is everyone's reference for "how we validate" going forward and it should read clean.

## Locked design decisions

**Virtual playfield, not raw canvas.** The game logic runs in a fixed 480-wide virtual coordinate space, scaled at render time to fit the canvas. This gives device-independent fairness — a phone and a 4K monitor play the same game. Playfield height = canvas height in virtual units (so virtual height varies with window, but width is locked at 480). Scale uniformly to fit; letterbox if needed; center horizontally.

**Player avatar:** 32×32 procedural `Graphics` rectangle. Fixed y near the bottom (virtual y = playfieldHeight − 80). x driven by input, clamped to `[16, 464]`. Color: `level.sensory.palette[1]` (the mid color in our restrained palettes is usually the right "player" color — readable against background and accents).

**Scroll speed:** 320 virtual pixels per second, constant for now. (The bible's "calm lanes" and "burst events" idea — speed modulation — comes in checkpoint 4 or later.)

**Obstacle spawning:**
- Spawn rate = `density × 8` per second. So `density: 0.15` (calm) ≈ 1.2/sec; `density: 0.5` (obstacle_wave) = 4/sec; `density: 0.9` (burst) = 7.2/sec.
- Use the level's `rng_seed`: parse the first 8 hex chars to a 32-bit unsigned int, seed a `mulberry32` PRNG, use it for *all* spawn decisions. Identical seed → identical run (modulo player input). This matters for Phase 2 anti-cheat; bake it in now.
- Spawns appear at virtual y = −obstacleHeight (just off the top), scroll down. Despawn when y > playfieldHeight + 16.

**Patterns** (only `obstacle_wave` uses these — `calm` always uses `random`):

```
sine:        x = 240 + sin((elapsed_ms_in_act / 800) * 2π) * 140
             // period 800ms, amplitude 140 virtual px around center
random:      x = rng.uniform(16, 464)
alternating: x = (spawnIndex_in_act % 2 === 0) ? 80 : 400
             // hard left vs hard right, no in-between
```

**Obstacle visual treatments** — define as a single dictionary at the top of `surge.ts`, keyed by `ObstacleType`:

| ObstacleType | width × height | color slot | extra |
|---|---|---|---|
| `paragraph` | 120 × 16 | `palette[0]` at α=0.7 | low-contrast, wide-and-short |
| `cta` | 40 × 40 | `palette[2]` | small, bright |
| `ad` | 80 × 60 | `palette[3] ?? palette[2]` | gentle alpha pulse, period 600ms, α 0.7→1.0 |
| `header` | 96 × 24 | `palette[0]` at α=0.9 | medium-bold |
| `image` | 64 × 64 | `palette[1]` | square-and-blocky |

If a level's palette has fewer entries than a slot index needs, fall back to the last available color. (The validator already enforces ≥3, so `palette[2]` is always safe; `palette[3]` is the only one needing fallback.)

**Collision:** AABB rectangle-vs-rectangle. On hit:
- Deduct `level.scoring.deductions.hit` from current score.
- 200ms player invulnerability (no further deductions during that window).
- 80ms canvas flash — overlay a translucent rectangle in `palette[2]` at α=0.3, fade out.
- The colliding obstacle despawns immediately.

**Scoring:**
- Start at `level.scoring.max_score`.
- Subtract on hit (as above).
- Floor at 0 — defensive, won't fire at Phase 0 numbers but cheap to add.
- `level.scoring.bonuses.no_hit_act` and `bonuses.perfect_section` are not awarded yet — those tie into act-completion semantics that come in checkpoint 4. Read the fields, don't act on them.

**Input** (`src/game/input.ts`):
- Normalize all of these to a single `playerX` in virtual coordinates (0–480):
  - Keyboard: `ArrowLeft` / `ArrowRight` / `A` / `D` move the player at 320 virtual px/sec. Hold-to-move.
  - Mouse: x coordinate, scaled from canvas-x to virtual-x.
  - Touch: same as mouse.
- The most recent input source wins. (User tapped a key after dragging? Keyboard takes over. Moved the mouse after a key? Mouse takes over.) Don't blend.
- Input latency target: <50ms perceived. Don't tween player movement — snap to target with optional smoothing under 30ms.

**Determinism for replay (Phase 2 setup):**
- The runtime should already structure its loop so that future-Phase-2 replay validation is trivial: spawn decisions come from the seeded PRNG; player position at frame N is a function of input events; nothing else uses `Math.random()`.
- Don't build the replay log itself yet — just don't introduce nondeterminism that would block it later.

## State machine

```
   ┌─────────┐  click tile   ┌─────────┐  duration_ms reached  ┌──────┐
   │ preview │─────────────►│ playing │──────────────────────►│ ended│
   └─────────┘               └─────────┘                       └──────┘
        ▲                         │                              │
        │                       Escape                           │
        │                         │                              │
        └─────────────────────────┴──────────────────────────────┘
                       Escape, click, or Space
```

- `preview`: existing three-tile view from checkpoint 2. Tiles become clickable.
- `playing`: SURGE running. Score visible as plain text overlay (top-left, 28px). No HUD polish.
- `ended`: dim background, show final score, best score, and "Press Space or click to return."

State lives in a single `RuntimeState` discriminated union in `runtime.ts`.

## File layout

```
src/
├── game/
│   ├── runtime.ts          # state machine, act scheduler, top-level frame loop
│   ├── rng.ts              # mulberry32 + seedFromHex helper
│   ├── input.ts            # multi-source input → playerX in virtual coords
│   ├── scoring.ts          # score state + localStorage best-score (key: linkwake:best:<url_key>)
│   └── verbs/
│       └── surge.ts        # SURGE-specific: spawn, obstacles dict, collision
├── shell/
│   └── results-overlay.ts  # the "ended" overlay (PixiJS Container builder)
├── main.ts                 # tile click handling + state machine wiring
└── styles/shell.css        # add `cursor: pointer` for the canvas in preview state, if needed
```

`shell/` is a new directory. Use it; we'll add HUD and share-card modules here in checkpoint 5.

## Build order (three commits, each pushed before starting the next)

1. **`phase0/game: scaffold rng, input, scoring, runtime modules`** — types and stubs only. `rng.ts` fully implemented (it's ~15 lines). `input.ts` exports a class/function returning `playerX`, fully implemented. `scoring.ts` implemented. `runtime.ts` and `surge.ts` export the right shapes but throw `"not implemented"` from their main entry points. `npm run build` passes.
2. **`phase0/surge: implement calm and obstacle_wave acts with collision`** — the meat. By the end of this commit you should be able to manually instantiate a SURGE run from devtools and play it; the integration to the tile preview is the next commit.
3. **`phase0/main: wire tile click → SURGE → preview state machine`** — make tiles interactive in `preview`, route `playing` and `ended` through the runtime and the new overlay. Update `CHANGELOG.md` here, single paragraph.

## Exit criteria

- Click any of the three tiles → SURGE runs on that level for ~45 seconds.
- Player avatar moves to arrows, A/D, mouse, and touch input. Input feels responsive (no perceptible lag).
- Obstacles only spawn during `calm` (sparse) and `obstacle_wave` (denser) acts. `intro`, `burst`, `channel`, `outro` are silent.
- Each level uses its own palette, font_class, density values, and obstacle types — the three levels feel visibly distinct in play, not just on the tile preview.
- Score starts at 10000, decreases on collision, ends at 0 floor.
- Run ends at 45000ms (or Escape). Results overlay shows current score and best score. Best persists across reload.
- `npm run build` clean. Bundle gzipped still under 300 KB.
- The validator's "extra fields" enforcement does not fire on any of the three level files (sanity check that you didn't accidentally tack new fields onto the schema while wiring things up).
- README and CHANGELOG reflect the current state.

## The fun-yield report (your last task before stopping)

When you push the third commit, in your "I'm done" reply tell me:

- The build size.
- Anything in the brief you had to deviate from, and why.
- Anything that *felt* off when you were testing the spawn math headlessly (sine amplitude too small? density mapping seem skewed? — your spec-vs-vibe intuition, since you can't play it).

I'll play it from there.

## What's out of scope (still)

- `burst`, `channel`, `intro`, `outro` rendering anything visible. Schedule them as silent acts.
- HUD: timer bar, score curve, ghost paths, percentile. Checkpoint 5.
- Audio. Howler stays unimported. Checkpoint 5.
- Share card / emoji grid. Checkpoint 5.
- Pause mid-run. Add only if it's free; otherwise checkpoint 4.
- Mobile-optimized layout (different obstacle density per viewport, etc.). Phase 3.
- The seeded RNG producing a replay log for server validation. Phase 2.
- Difficulty scaling between levels beyond what's already in the JSON. Don't tune yet — let me play and decide what needs tuning.

## Working norms

- Same as prior checkpoints. Commit per build-order step. Push before starting the next. Update `CHANGELOG.md` once at the end with one paragraph.
- **No new npm dependencies.** If you find yourself wanting Matter.js for collision (you don't, AABB is sufficient), or any audio library, stop and ask.
- If a parameter in this brief feels wrong while you're implementing — say, the density-to-spawn-rate constant of 8 produces obviously broken output — flag it in chat before changing it. The numbers are picked to be reasonable starting points, not gospel.
- If the bible and this brief disagree, the bible is canonical. If the tech plan and this brief disagree, the tech plan is canonical. If you find a real contradiction, surface it before resolving.

When done: push, stop, and report.
