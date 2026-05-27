# Changelog

## Phase 0 - Checkpoint 1

Added the Phase 0 project documents to the repo root and scaffolded the static LinkWake app shell with Vite, strict TypeScript, PixiJS v8, root metadata, and a minimal renderer proof. This checkpoint intentionally stops before level schema, SURGE gameplay, audio, storage, sharing, or any infrastructure.

## Phase 0 - Checkpoint 2

Locked the v1 level-script contract with exhaustive TypeScript types and a hand-rolled runtime validator, then added three validated placeholder level scripts for longform, reference, and commerce archetypes. The app shell now imports those levels at module load and renders a static PixiJS three-tile preview with distinct palettes and font feels, while still deferring SURGE gameplay, input, audio, sharing, and infrastructure.

## Phase 0 - Checkpoint 3

Added the first interactive SURGE runtime: tiles now start deterministic seeded runs, keyboard/mouse/touch input drives a fixed-width virtual playfield, calm and obstacle-wave acts spawn dodgeable obstacles, collisions deduct score with brief invulnerability and flash feedback, and completed or escaped runs show a PixiJS results overlay with local best-score persistence. Burst, channel, intro, outro visuals, audio, HUD polish, sharing, replay logs, and any backend remain deferred.

## Phase 0 - Checkpoint 3.5

Added the first sensory pass for SURGE: preview tile host text is contrast-aware, spawn density now uses a named tuned curve, and each archetype now changes scroll speed, keyboard movement speed, spawn-rate multiplier, background texture, obstacle treatment, and player avatar styling. Longform now plays slower with column rails and text-line obstacles, reference remains the neutral grid baseline, and commerce plays faster with diagonal pressure, chunkier CTA/image obstacles, and button-like avatar styling while keeping the same schema, level JSON, act scope, scoring, and deterministic seeded RNG.
