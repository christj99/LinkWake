# LinkWake — Phase 0, Checkpoint 3.5: SURGE sensory pass

## Reading order

Before writing code:

1. `webwave_form_maturity_bible_v0_1.md` §8 (Sensory Translation) — this is the canonical text for what this checkpoint exists to deliver.
2. Bible §2.3 ("The commentary is structural, not accusatory") — the differences between archetypes are *felt*, never labeled.
3. `prompts/checkpoint-3.md` — what shipped, including the density and visual-treatment decisions we're now revising.
4. Current `src/game/verbs/surge.ts` and `src/game/runtime.ts` — what's actually there before you change anything.

## What this checkpoint proves

Checkpoint 3 shipped a mechanically playable SURGE loop. Playtesting revealed the real Phase 0 problem: the three levels feel like cosmetic variants of the same game, not three distinct worlds. Per the bible: *"Without sensory fidelity, WebWave becomes 'same game, different density.' With sensory fidelity, players can feel that a corporate page, a personal blog, a recipe page, and a government form are different worlds."*

By the end of checkpoint 3.5, NYT, Wikipedia, and Amazon should feel *categorically different to play* — not just to look at. If I close my eyes, listen for nothing (audio comes later), and pay attention only to scroll feel, obstacle density curves, and visual texture, I should be able to identify which level I'm in within ten seconds.

That's the bar. Not "looks pretty." *Feels different.*

**Crucially: no new act kinds in this checkpoint.** `intro`, `burst`, `channel`, `outro` remain silent. If page identity doesn't emerge from `calm` + `obstacle_wave` alone, it won't emerge from more variety — it'll just produce three samey complex levels. We test the hypothesis at its hardest.

## What's wrong now (the diagnosis)

Three concrete problems from playtesting and the screenshots:

1. **Background is solid black everywhere.** No sense of *being inside* a particular kind of page. The bible's "DOM complexity represented as layering, parallax, occlusion, or jitter" is doing zero work right now.
2. **Obstacle visual treatments are too similar across archetypes.** The treatment dictionary keys by `ObstacleType`, but every archetype draws the same rectangle for `paragraph`, the same square for `image`, etc. The archetype itself contributes nothing to obstacle feel beyond palette substitution.
3. **Scroll speed and density curves are identical across archetypes.** A NYT longform and an Amazon product page scroll at exactly the same 320 px/sec, with exactly the same spawnsPerSecond = density × 8 mapping. That's the biggest single contributor to "same game, different colors."

There's also a real contrast bug in the preview: `palette[0]` host text on tile background is unreadable for `commerce` (`#0f1111` on `#0b0d10`). Codex made the in-game score contrast-aware in checkpoint 3 — propagate that fix back to the preview tiles too.

## Pre-flight fixes (separate commit, do first)

**Single commit, message: `phase0/chore: fix preview tile contrast and density curve`**

1. **Preview tile host text:** apply the same contrast-aware logic Codex wrote for the in-game score overlay to the preview tiles. The host name should be readable against the tile background regardless of palette. If you already have a helper from checkpoint 3, reuse it. If not, the simple rule is: if the candidate color's relative luminance is below some threshold (0.5 is fine for now) and the background is also dark, fall back to a light off-white (`#e6e8ee`). Don't over-engineer it.

2. **Density curve tuning:** Codex's vibe note was right — `density × 8` at `0.7` (Amazon's second obstacle_wave) produces 5.6 spawns/sec, which is probably spicy with 40×40 CTAs. Change the mapping from a linear `density × 8` to:

   ```
   spawnsPerSecond = lerp(0.5, 7, density)
   // density=0 → 0.5/s (one spawn every 2s, prevents long empty stretches)
   // density=0.5 → 3.75/s (was 4, slightly tamer)
   // density=1.0 → 7/s (was 8, less brutal at the top)
   ```

   Add this as a named function `spawnRateForDensity(density: number)` in `surge.ts` so future tuning is one-line.

3. **Validator nit from the checkpoint 2 review you didn't catch:** in `validateAct`, the lines

   ```ts
   expectNumber(act.t, `${path}.t`, fail);
   expectNonNegativeNumber(act.t, `${path}.t`, fail);
   ```

   are redundant — the second already calls the first. Same for `duration`. Drop the `expectNumber` calls. Cosmetic, but the validator is everyone's reference for "how we validate."

These three are a single commit. Push, then move on to the sensory work.

## The sensory pass (locked decisions)

### Per-archetype scroll feel

The scroll speed and player-movement feel should differ by archetype. This is the single biggest lever for "feels like a different world."

Add a per-archetype config dictionary in `surge.ts`:

| archetype | scroll speed (vpx/s) | player move speed (vpx/s) | spawn-rate multiplier |
|---|---|---|---|
| `longform` | 220 | 280 | 0.85 |
| `reference` | 320 | 320 | 1.0 |
| `commerce` | 420 | 360 | 1.25 |
| `media` | 320 | 320 | 1.0 |
| `data` | 280 | 300 | 1.0 |
| `generic` | 320 | 320 | 1.0 |

Reasoning (don't put this in code, just internalize it):
- **`longform` is slow and contemplative.** A NYT article scrolls under you like reading. You have time to think. Player moves at almost normal speed but obstacles approach gently.
- **`reference` is the neutral baseline.** Wikipedia is the unmarked case — what we tuned in checkpoint 3.
- **`commerce` is loud, fast, aggressive.** Amazon's pages assault attention; SURGE on commerce should physically feel like that. Faster scroll, more spawns, slightly more responsive player to compensate (but not fully — pressure is the point).

The `spawn-rate multiplier` multiplies the output of `spawnRateForDensity`. So Amazon at `density=0.7` is `lerp(0.5, 7, 0.7) × 1.25 = 5.5/s` versus Wikipedia at the same density yielding `4.4/s`. Different, not crushing.

### Per-archetype background texture

Black-on-black has to go. Each archetype gets a procedural background drawn with PixiJS `Graphics`, faint enough to read as texture rather than UI. All textures scroll downward at half the obstacle speed for a parallax effect.

| archetype | texture |
|---|---|
| `longform` | Two faint vertical lines at x=120 and x=360 in virtual coords, suggesting newspaper columns. Color: `palette[1]` at α=0.06. Width: 1 virtual px. Static (no scroll) — they're rails, not motion. |
| `reference` | A muted grid of 80×80 squares, 1px lines, `palette[0]` mixed lighter at α=0.08. Suggests structured tables / encyclopedia layout. Scrolls. |
| `commerce` | Diagonal stripes (45°), `palette[2]` at α=0.05, 32 virtual px between stripes. Slight motion: stripes drift at scroll speed. Suggests aggressive promo / "BUY NOW" energy. |
| `media` | TBD — pick something coherent if time, otherwise default to reference's grid. |
| `data` | TBD — same. |
| `generic` | No texture. Stay clean. |

For Phase 0 we only have `longform`, `reference`, `commerce` levels — implement those three properly and let the others fall back to `generic`'s no-texture default. We can refine in later phases.

Implementation note: backgrounds go in a single `Graphics` instance drawn once on level start and tinted/positioned by archetype. For the scrolling ones (grid, stripes), redraw or shift the graphic each frame within a tile-modulo so they appear infinite. Don't allocate new objects per frame.

### Per-archetype obstacle treatments

The current treatment dictionary keys only on `ObstacleType`. Extend it to a function `(archetype, obstacleType) → ObstacleTreatment`, where each archetype can override specific obstacle types.

Defaults (same as today's treatments) for `reference` and `generic`. Overrides:

**`longform`:**
- `paragraph` (the dominant obstacle for NYT's wave 1): widen to 160 × 14, alpha to 0.55. Feels more like a *line of text* than a brick.
- `cta` (NYT's wave 2 burst): make smaller and brighter — 32 × 32, full alpha, `palette[2]`. The single jarring intrusion.
- `ad` (NYT's wave 6): increase pulse intensity — alpha 0.5 → 1.0 over 500ms (was 0.7 → 1.0 over 600ms). Reads as more aggressive interruption.

**`commerce`:**
- `cta` (Amazon's dominant): pump up size to 48 × 48, full alpha, faint outer glow (just a slightly larger same-color rect at α=0.3 drawn behind). Aggressive feel.
- `image`: increase to 80 × 80. Big chunky product blocks.
- `ad`: pulse faster — 350ms period, alpha 0.6 → 1.0. Demanding.

Encode this as:

```ts
type ObstacleTreatment = {
  width: number;
  height: number;
  paletteSlot: number;  // index into level.sensory.palette with last-color fallback
  alpha: number;
  pulse?: { period_ms: number; min_alpha: number; max_alpha: number };
  glow?: { paletteSlot: number; alpha: number; expand: number };
};

function treatmentFor(archetype: Archetype, type: ObstacleType): ObstacleTreatment
```

This function is the only place per-archetype obstacle styling lives. Future archetypes extend it; future obstacle types extend it; no other code branches on archetype × obstacle.

### Player avatar by archetype

Tiny touch, big payoff. The player rectangle gets a different visual signature:

- `longform`: rounded corners (4 vpx radius), `palette[1]`, thin outline in `palette[2]`. Reads as a piece of text.
- `reference`: sharp square, `palette[1]`, no outline. Reads as a citation token / link node.
- `commerce`: sharp square with a 2vpx-wide outline in `palette[2]`, slight inner highlight. Reads as a UI button.

Don't change hitbox — still 32 × 32 virtual.

### Music? No.

Audio is still out of scope. If you're tempted, don't. Checkpoint 5.

## What's NOT changing

- The schema (`src/types/level-script.ts`). The same level files drive everything; sensory variation comes from how the runtime *interprets* the archetype, not from new schema fields.
- The level JSONs. Same as checkpoint 2.
- The state machine (preview → playing → ended).
- Input handling.
- Scoring math (still `max_score` minus `deductions.hit` per collision, floored at 0).
- Determinism (still seeded RNG, still no `Math.random()`).
- Act kinds (`intro`, `burst`, `channel`, `outro` remain silent).

## File changes expected

- `src/game/verbs/surge.ts` — most of the work lands here. Per-archetype config dictionary, `treatmentFor()` function, background drawer, scroll-speed and movement-speed wiring.
- `src/game/runtime.ts` — wire the archetype-aware scroll speed into the frame loop. Wire the background layer into the playing-state rendering.
- `src/main.ts` — fix preview tile contrast.
- `src/types/level-script.ts` — small validator cleanup.
- `CHANGELOG.md` — one paragraph.

No new files. No new directories. No new dependencies.

## Build order (three commits)

1. **`phase0/chore: fix preview tile contrast and density curve`** — the pre-flight fixes section above. Push, then proceed.
2. **`phase0/surge: per-archetype scroll feel and background texture`** — scroll speeds, movement speeds, spawn-rate multipliers, background textures. By end of this commit, the three levels should feel different in tempo and ambient texture even before obstacle treatments differ.
3. **`phase0/surge: per-archetype obstacle treatments and player avatar`** — `treatmentFor()` function with the longform and commerce overrides, archetype-styled player avatar. Update `CHANGELOG.md` here.

## Exit criteria

- `npm run build` clean. Bundle gzipped still under 300 KB.
- Playing NYT for 10 seconds and Amazon for 10 seconds feels obviously different — different tempo, different visual ambient, different obstacle character. (This is the real test. Codex can't run it, so flag any place you're uncertain whether the spec produces enough difference.)
- The preview tiles all show readable host names, including Amazon.
- Determinism still holds — same seed produces the same obstacle layout (sensory layer doesn't affect spawn decisions).
- Validator still rejects malformed level files with precise paths.

## Fun-yield report (your last task before stopping)

In your "I'm done" reply:

- Build size.
- Anything you had to deviate from, and why.
- **Most important:** which of the per-archetype tunings you're least confident in. If `commerce` scroll at 420 vpx/s feels like it'd be unfair rather than aggressive, or if the longform columns at α=0.06 will be invisible in practice — say so. The numbers in this brief are first-pass guesses, not measurements. I'll play and we'll tune from there.

## Working norms

- Three commits, each pushed before the next, stop after the third.
- One CHANGELOG paragraph at the end.
- No new dependencies. Period.
- If you find the bible's §8 ("Sensory Translation") suggests a treatment this brief contradicts, surface it before resolving — the bible wins.

When done: push, stop, report.
