# WebWave Technical Development Plan: A Phased Roadmap for a Solo Builder

## TL;DR

- **Build the daily web-only ritual on one verb first, with no extension, no Atlas, and no AI in the loop.** The single most important risk in WebWave is the "fun-yield problem" — will pages actually produce fun levels? — and that risk is only resolvable by playing the output, not by building infrastructure. Phase 0–2 (≈10–14 weeks) should ship a daily Wordle-style page-as-level experience powered by a deterministic, heuristic Level Compiler running on the server, with verb microgames in PixiJS v8 and DOM signals extracted via Mozilla Readability plus a custom feature walker.
- **The stack that gives a solo dev the most leverage in 2026 is: WXT (extension) + PixiJS v8 (runtime) + SvelteKit (shell) + Hono on Cloudflare Workers + Neon Postgres + Cloudflare R2 + Claude Haiku 4.5 (classification only).** Manifest V3 dictates a "Summon" UX that happens to align with the architectural rules in the vision document (activeTab only, no host_permissions). Cloudflare's egress-free network is what makes ghost traces, archived page replays, and Atlas tile delivery economically viable at solo-dev scale.
- **Defer the Atlas, Lens Studio, Archive replay, and ML page-anatomy models until after public daily-ritual retention is proven (Phase 5+).** Build them as compositions over the same `(url_key, version_key, lens_id, viewport_class)` content-addressable schema you ship in Phase 2. Roblox-style creator marketplaces and Genie-3-style generative interpretations are reserved for Phase 8+ and should remain explicitly out of scope for a solo dev's first 12 months.

---

## Key Findings

1. **The Level Compiler is the product.** A solo dev can ship a *minimum viable* Compiler in ~2–3 weeks if it stays heuristic — Mozilla Readability for content boundaries, EasyList for ad/footer exclusion, `getComputedStyle` + `getBoundingClientRect` for layout vectors, and a fixed JSON schema that maps these to verb parameters. ML-based segmentation (MarkupLM, VIPS) is a Phase 6+ luxury; the 2023 SIGIR benchmark by Bevendorff et al. found that heuristic extractors like Readability (median F1 0.970) and Trafilatura (mean F1 0.883) *outperform* deep-learning extractors on the messy, complex pages WebWave actually cares about. As the Chuniversiteit summary of that paper bluntly puts it, "heuristic extractors perform the best and are most robust across the board, whereas the performance of large neural models is surprisingly bad – especially on the most complex pages for which they were primarily designed!"
2. **Picking PixiJS v8 over Phaser 3 is correct for this product.** SURGE, COLLECT, SLICE, RHYTHM, STACK, RACE, ECHO are all renderer-bound, not physics-bound. Phaser 3 ships Arcade Physics, scene management, and a tween system you don't need, while PixiJS v8 gives you WebGPU with WebGL fallback, a ~3× smaller bundle (~450KB vs ~1.2MB per Generalist Programmer's measurements), and the headroom for the Atlas tile renderer later. The one place Phaser's batteries-included design would help — TRACE (navigate) and BALANCE (sort) microgames with collision — is solvable with Matter.js-as-a-module (~85KB) layered on PixiJS.
3. **Manifest V3 forces a Summon model that happens to match the privacy posture in the vision doc.** Service workers terminate after ~30s idle, can't keep persistent state in globals, and Chrome reviewers reject `activeTab + <all_urls>` combinations as redundant — confirmed by the DEV.to "Manifest V3 Migration Pitfalls" writeup from a developer of 17 MV3 extensions: "Two of my extensions were rejected for requesting activeTab + <all_urls> together, which was considered redundant." The right design: extension declares only `activeTab` and `scripting`, content script injects on user click, page-feature extraction happens entirely in the content script, and only a feature *signature* (no raw text, no screenshot) gets posted to the backend. This is also the design Chrome reviewers want — and matches the "no raw page text/screenshots transmitted" rule.
4. **Cloudflare Workers + R2 + a single Neon Postgres instance is the cheapest viable backend at every scale WebWave will hit before product-market fit.** Workers cost a flat $5/month at the paid tier and have zero egress; R2 has zero egress; Neon's free plan, per neon.com/docs/introduction/plans (May 2026), "Includes 100 projects, 100 CU-hours/project, 0.5 GB storage per branch, and 5 GB of egress." At 10 users you pay $0. At 1,000 users you pay ~$5–25/month. At 100,000 users with daily play the dominant cost becomes ghost-trace storage in R2 (~$15–60/month for 1–4TB of compressed binary replays) and Claude Haiku 4.5 classification calls (~$30–100/month if you classify every page-version-lens triple — heavily cacheable down to ~$5–15/month with prompt caching and aggressive content-addressing).
5. **Anti-cheat in WebWave should be designed as "verb-replay validation," not server-authoritative simulation.** Wordle's reverse-engineering history (the wordlist was discovered in minified JS within a day of launch — Mottaqui Karim's writeup showed `var Ma = ["cigar", "rebut", "sissy", "humph", "awake"...]` was right there in the source) is the cautionary tale. The right pattern is the `petergeorgas/Wordle-API` pattern documented on GitHub: *"The whole point of this API is to allow you to create a Wordle clone that keeps the answer OFF of the user's computer."* The server holds the level script and scoring oracle; the client uploads its full input trace (keystrokes + timestamps + RNG seeds); the server re-simulates deterministically and accepts the score only if the simulation matches. This is feasible because verb microgames are intentionally short (15–60s) and deterministic.
6. **The Daily Ritual is the right MVP, not the extension.** Building the extension first means committing to MV3 review, cross-origin DOM headaches, and a content-script bundle in week 1, before you've validated that "page → level" is fun. The web-only daily page bypasses all of that: GitHub Actions cron job picks one URL/day, server fetches it with Playwright, compiles it offline into a level script, and serves the script + verb runtime as a regular SPA. The extension is Phase 4.

---

## Details

### Phase 0 — Fun-Yield Prototype (1–2 weeks)

**Goal:** Answer the only question that matters: *does a page-derived level produce 60 seconds of actual fun?*

**Scope:**
- Single static HTML page with PixiJS v8 (`autoDetectRenderer`, WebGPU→WebGL fallback).
- One verb only: **SURGE** (dodge-em-up that scrolls vertically; obstacles are placed by hand from a manually authored JSON).
- Three hand-authored level scripts, one per archetype: a news article, a Wikipedia page, an e-commerce product page.
- No backend. No accounts. Score lives in `localStorage`. Share button copies a 🟩🟨⬛-style emoji result grid (lifted directly from the `react-wordle` `generateEmojiGrid()` pattern in `src/lib/share.ts`).

**Tech specifics:**
- Bundler: Vite 5+, vanilla TypeScript. No framework yet.
- PixiJS v8 via `npm i pixi.js@8`. Use the new `autoDetectRenderer` to ship WebGPU when present (PixiJS v8 implements WebGPU support with automatic fallback per the PixiJS v8 announcement).
- Asset pipeline: stick to procedurally drawn `Graphics` for now — no sprite atlases until Phase 2.
- Audio: Howler.js for SFX (impact, score tick); defer Tone.js until you actually have generative audio worth designing.

**Exit criteria:**
- You play your own SURGE level on each of the three archetypes ≥10 times in one session. If a friend who doesn't know the project plays it once and asks to play again, you pass. If nobody asks for a second play, **the entire product premise is wrong** — stop and rethink before building infrastructure.
- Lighthouse Performance ≥90 on a mid-range Android.
- Bundle ≤300KB gzipped.

**Intentionally deferred:** Compiler, extension, accounts, leaderboard, any AI, any verb other than SURGE, all sensory mapping beyond hand-picked colors.

**Cost:** $0.

---

### Phase 1 — Deterministic Heuristic Compiler v0 (3–4 weeks)

**Goal:** Replace the hand-authored level scripts from Phase 0 with a real Compiler that runs on real pages.

**Scope:**
- A Node.js script (`compiler/compile.ts`) that takes a URL, runs Playwright headed-Chromium, and produces a level script JSON.
- Three verb microgames implemented: SURGE, COLLECT, RACE. These three cover ~70% of the page archetype space (vertical scroll, item collection, scroll-terrain navigation).
- The compiled level script JSON is committed to a Git repo and loaded statically by the Phase 0 page.

**The Compiler at this stage (the heart of the product, kept simple):**

```
INPUT:  url
PIPELINE:
  1. Playwright launch → goto(url, {waitUntil: 'networkidle'})
  2. inject Mozilla Readability → parse() → { mainContent, title, byline, length }
  3. inject DOM walker → for every visible element under <body>:
       collect { tag, role, getBoundingClientRect(),
                 getComputedStyle.{color, backgroundColor, fontSize,
                                   fontWeight, display, position},
                 textLength, linkDensity, depthFromBody, isInMainContent }
  4. EasyList exclusion pass → drop elements matching ad/footer/nav cosmetic filters
  5. Layout vector extraction:
       - pageHeight (px), pageWidth, scrollable_columns
       - hero_box (largest above-the-fold image+heading cluster)
       - body_rhythm = histogram of element heights along Y axis
       - palette = top-5 colors by pixel-area weight
       - density_map = 2D grid of element-presence (used to lay out obstacles)
  6. Page archetype classifier (heuristic, no LLM yet):
       if length > 2000 && linkDensity < 0.2 → "longform"
       elif productSchemaPresent → "commerce"
       elif videoElement || og:video → "media"
       elif tableCount > 3 → "data"
       else → "generic"
  7. Verb selector: archetype → verb (longform→SURGE, commerce→COLLECT, media→RHYTHM, data→BALANCE, generic→TRACE)
  8. Level script emitter (deterministic, seeded from sha256(canonical_url + content_digest))
OUTPUT: level_script.json
```

**Level script schema (lock this early — it's the contract everything else depends on):**

```json
{
  "schema_version": 1,
  "url_key": "https://example.com/article",
  "version_key": "sha256:...",
  "lens_id": "canonical",
  "viewport_class": "desktop",
  "compiled_at": "2026-05-27T...",
  "archetype": "longform",
  "verb": "SURGE",
  "duration_ms": 45000,
  "rng_seed": "sha256:...",
  "acts": [
    { "t": 0,     "kind": "intro", "payload": {...} },
    { "t": 2000,  "kind": "obstacle_wave", "payload": {"pattern":"sine","amplitude":120,"period":800} }
  ],
  "scoring": {
    "max_score": 10000,
    "deductions": {"hit": 100, "miss": 50},
    "bonuses":   {"perfect_section": 500}
  },
  "sensory": {
    "palette": ["#1a1a1a", "#ff4060"],
    "rhythm_bpm": 96,
    "font_class": "serif-heavy"
  },
  "source_signatures": {
    "page_height_px": 8420,
    "hero_box": [120, 80, 800, 500],
    "body_rhythm_hash": "..."
  }
}
```

**Tech specifics:**
- Playwright 1.50+ in headed mode for first runs (you'll watch what it does), headless later.
- Mozilla Readability via `@mozilla/readability` + `jsdom`. Alternatives considered: Trafilatura (Python, 0.883 mean F1 in Bevendorff et al.'s SIGIR'23 benchmark, but requires a Python sidecar); `markusmobius/go-domdistiller` (Chrome's reader-mode port, F1 0.927 in Zyte's benchmark, but Go). Readability wins for solo-dev simplicity: one npm install, runs in Node and in the browser content script, MIT license. SIGIR'23 found Readability has the highest *median* F1 (0.970), which matters more than mean when your downstream consumer is a deterministic compiler that needs reliable structure on the easy 90% of pages.
- DOM walker: hand-rolled — no library exists that emits exactly the feature set above. ~150 lines of TypeScript. Keep it pure: input is `document`, output is JSON, no side effects.
- EasyList consumption: pull `easylist.txt` at build time, parse cosmetic filter section (`##selector` lines), build a single CSS selector list per host. uBlock Origin's filter syntax wiki is the reference. Drop the procedural cosmetic filters (`:has-text()`, `:has()`, `:upward()`) for now — too complex.
- Version key algorithm: `sha256(normalize(html_after_readability) + normalize(json_layout_signature))`. Normalization strips dates, view counters, ad iframes, and any element with `data-nosnippet` or `[aria-live]`. This is your page-volatility solution.

**Exit criteria:**
- Run the compiler against a hand-picked set of 30 URLs across the 5 archetypes. Manually play the resulting level on each. ≥20/30 must feel "of the page" — i.e., the rhythm, palette, and obstacle distribution must be recognizably derived from the source, not random.
- Re-compile each URL 3 times across a week. Version_key must be stable on ≥25/30 (proves the volatility normalization works).

**Intentionally deferred:** Backend, accounts, leaderboard, extension, ML, audio composition, ECHO/SLICE/STACK/DEFEND verbs, all of FREEFORM, viewport-class variants beyond desktop, lens system.

**Cost:** $0 (everything local).

---

### Phase 2 — Daily Ritual MVP (4–6 weeks)

**Goal:** Ship a public, Wordle-shaped daily page-as-level with a real backend, real leaderboard, and verb-replay anti-cheat in place.

**Stack lock-in:**

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| Shell framework | **SvelteKit 2** | SolidStart is faster but Svelte's compiler tooling and the SvelteKit endpoint model give a solo dev more leverage on a part-static, part-dynamic site. React is rejected — the shell has ~5 routes and you don't want React 19's hydration complexity here. |
| Game runtime | **PixiJS v8** | Already chosen Phase 0. WebGPU+WebGL, tree-shakeable, ~450KB. |
| Physics (when needed) | **Matter.js as module** | Only loaded for BALANCE/STACK; PixiJS does no physics on its own. |
| Audio | **Howler.js for SFX, Tone.js for procedural** | Per pkgpulse.com's 2026 web-audio comparison, Howler currently sits at ~1.5M weekly downloads vs Tone.js at ~600K — Howler is the default for cross-browser sprite playback, Tone.js for `Transport`-synced rhythm in the RHYTHM verb. MDN's best-practices doc and the Supadark decision tree converge: Howler for files, Tone for synthesis. |
| Backend runtime | **Hono on Cloudflare Workers** | Workers gives sub-5ms cold starts (per Cloudflare's published architecture: "Standard Workers cold starts are under 5ms, thanks to V8 isolates (no container or VM boot)"), $5/mo paid floor, zero egress. Hono is the V8-isolate-native framework. Vercel is rejected: per-user pricing and ISR-write costs become hostile when ghost traces and Atlas tiles drive bandwidth. |
| Database | **Neon Postgres** | Scale-to-zero with ~1s resume, branching for CI, free plan includes 100 projects with 0.5GB storage per branch and 5GB egress. The "Why I Switched from Supabase to Neon" pattern matches WebWave: you don't need Supabase's bundled auth/realtime/storage in Phase 2 — you have your own. |
| Object storage | **Cloudflare R2** | Zero egress is decisive when ghost traces and Atlas tiles ship. $0.015/GB stored, $0 egress (verified at egresscost.com against Cloudflare's pricing page, April 2026). |
| Auth | **Clerk** or **Lucia + GitHub OAuth** | Clerk for speed (free up to 10k MAU); Lucia if you want zero vendor lock-in. Both ship in <1 day. |
| Daily picker | **GitHub Actions cron** | Free for public repos. Picks URL, calls Compiler on a Render/Fly worker, commits the level_script.json to a versioned bucket in R2. |

**Backend services that exist at end of Phase 2:**

```
api.webwave.example
├── POST /v1/sessions/start  → returns { session_jwt, level_script, server_time }
├── POST /v1/sessions/event  → append-only input event log (signed with session_jwt)
├── POST /v1/sessions/submit → finalize; server re-simulates → score
├── GET  /v1/daily            → today's level metadata (no spoilers)
├── GET  /v1/leaderboard/:date
└── GET  /v1/ghosts/:date/top → top-N ghost traces (R2 signed URLs)
```

**Database schema (Postgres):**

```sql
-- The content-addressable triple is the load-bearing concept.
CREATE TABLE levels (
  id            uuid PRIMARY KEY,
  url_key       text NOT NULL,
  version_key   text NOT NULL,    -- sha256 from compiler
  lens_id       text NOT NULL DEFAULT 'canonical',
  viewport_class text NOT NULL DEFAULT 'desktop',
  archetype     text NOT NULL,
  verb          text NOT NULL,
  script_r2_key text NOT NULL,    -- pointer into R2
  compiled_at   timestamptz NOT NULL,
  UNIQUE (url_key, version_key, lens_id, viewport_class)
);

CREATE TABLE daily_assignments (
  date          date PRIMARY KEY,
  level_id      uuid REFERENCES levels(id),
  curator_note  text
);

CREATE TABLE sessions (
  id            uuid PRIMARY KEY,
  user_id       uuid,
  level_id      uuid REFERENCES levels(id),
  started_at    timestamptz,
  submitted_at  timestamptz,
  raw_score     int,
  validated     boolean,
  replay_r2_key text          -- input trace
);

CREATE TABLE leaderboard (
  date date, user_id uuid, score int, session_id uuid,
  PRIMARY KEY (date, user_id)
);
```

**Anti-cheat design (the petergeorgas pattern, adapted):**
1. `POST /sessions/start` issues a JWT signed with HS256, containing `{ session_id, level_id, server_start_ms, nonce }`. Expires in 10 minutes.
2. Client opens a WebSocket back to a Worker (Durable Objects, cheap at this scale) and streams input events as MessagePack-encoded frames: `{ t_ms, kind, payload }`. WebSocket keeps the service worker alive per Chrome 116+ rules: "Active WebSocket connections now extend extension service worker lifetimes. Sending or receiving messages across a WebSocket in an extension service worker resets the service worker's idle timer" (Chrome for Developers SW lifecycle docs).
3. Server stores the raw event log in R2 (one object per session, gzipped). Typical size: 4–20KB per 60s session.
4. On `submit`, server **re-simulates** the verb microgame using the same deterministic engine the client used, seeded with the level's `rng_seed`. If `server_score == client_score`, accept. If they diverge, log and reject.
5. Sanity heuristics: reject sessions where `(events.length / duration_ms) > human_max` (e.g., >30 inputs/sec), reject sessions with sub-100ms reaction events, rate-limit per IP and per user.

**Ghost storage format:**
- Per-session input trace: MessagePack. Per OneUptime's March 2026 Redis-serialization benchmark, MessagePack is "20-40% smaller than JSON" generally and 45.3% smaller on their sample object (53 bytes JSON → 29 bytes MessagePack). Protobuf would compress harder (~75% reduction in the same benchmark) but the schema-evolution discipline isn't worth it for a single solo-dev codebase. Gzip on top.
- Ghost playback: client downloads the top-N MessagePack blobs via signed R2 URLs, replays them in PixiJS as ghost sprites.

**Curated daily pick:**
- GitHub Actions workflow at 00:00 UTC: pull from a hand-curated URL list (committed to a private repo), run Compiler, write level to R2, insert into `daily_assignments`.
- Curate by hand for the first 90 days. **Do not** automate URL selection with an LLM yet.

**Verbs implemented by end of Phase 2:** SURGE, COLLECT, RACE, RHYTHM. Defer SLICE, BALANCE, TRACE, STACK, DEFEND, ECHO, FREEFORM.

**Exit criteria:**
- 200 unique users play on day 7 of launch.
- Median session: 1.4 days played in first 7 days.
- Zero successful score forgeries in the first 1,000 submissions (test by trying to forge your own).
- Backend p99 latency <200ms.

**Intentionally deferred:** Extension, Atlas UI, Archive, Lens system, AI of any kind beyond manual curation, friend ghosts (only AI-derived "median player" ghost in Phase 2).

**Cost projection (Phase 2 running):**
- Workers paid: $5/mo
- Neon Launch (if you exit free tier): $19/mo
- R2: ~$0.50/mo at first
- Clerk free tier up to 10k MAU
- Cloudflare DNS/Pages: $0
- Domain: ~$12/yr
- **Total: $5–25/mo through ~1,000 DAU.**

---

### Phase 3 — Multi-Verb Compiler & Sensory Mapping (4–6 weeks)

**Goal:** Bring the Compiler from "viable" to "compelling." Add the remaining verbs, formalize sensory mapping, introduce viewport_class variants.

**Scope:**
- Implement SLICE (precision), BALANCE (sort), TRACE (navigate), STACK (organize).
- Defer DEFEND, ECHO, FREEFORM to Phase 5.
- Compiler v1: introduce a `lens_id` parameter that controls archetype→verb mapping, allowing the same page to compile to different verbs.
- Sensory mapping: formal mapping from page signals to:
  - **Palette:** k-means clustering of element-area-weighted colors → 5 ramps.
  - **Rhythm:** detected from heading density along the Y axis. Headings/sec → BPM.
  - **Font feel:** category mapped to one of 6 procedural particle styles.
- Viewport classes: `desktop`, `mobile`. Mobile compile uses different obstacle density and verb selection (smaller screens favor SLICE/RHYTHM over SURGE/RACE).

**LLM integration — but only for classification, never gameplay code:**
- Introduce **Claude Haiku 4.5** ($1/$5 per MTok per Anthropic's pricing page as of May 2026) for archetype classification. Replace the heuristic in Phase 1's step 6.
- Cache aggressively: prompt-cache the 4KB system prompt; key the classification result by `version_key`. Per Anthropic's pricing docs, cache reads cost 10% of the standard input price, so a ~500-token classification call with a cached system prompt costs ~$0.001 raw, and a 99%-cache-hit rate effectively reduces that another order of magnitude.
- Why Haiku 4.5 over GPT-4o-mini ($0.15/$0.60): Haiku 4.5 supports prompt caching with the 90% discount on cached input, scores 73.3% on SWE-bench Verified (Anthropic's official Oct 15, 2025 announcement: "We report 73.3%, which was averaged over 50 trials, no test-time compute, 128K thinking budget...on the full 500-problem SWE-bench Verified dataset"), which is only 3.9 percentage points behind Sonnet 4.5's 77.2% on the same benchmark, and Anthropic's 200K context lets you stuff the full Readability output into one call. GPT-4o-mini is cheaper per raw token but lacks comparable caching depth.
- Embeddings: defer to Phase 6. You don't need similarity search yet.

**Tech additions:**
- Job queue: Cloudflare Queues (GA, $0.40/M operations) for async compile jobs.
- Compile workers: keep Playwright-based compiler on Fly.io machines (one always-on `shared-cpu-1x` machine at ~$2/mo, scales horizontally if needed). Cloudflare Workers can't run Playwright.

**Exit criteria:**
- 8 verbs shipped.
- Mobile compile produces a level whose verb selection differs from desktop on the same URL ≥40% of the time.
- ≥30% of daily players play on mobile.

**Intentionally deferred:** Extension, Atlas, Archive, Lens marketplace.

---

### Phase 4 — Summon Extension (4–6 weeks)

**Goal:** Ship the user-invoked extension that turns the active page into a level on demand.

**Architectural decisions driven directly by Manifest V3 and the vision document's privacy rules:**

| Decision | Choice | Reason |
|---|---|---|
| Framework | **WXT** | Per ExtensionBooster's 2026 framework comparison: "In our testing, WXT produces extensions around 400 KB - roughly 43% smaller than Plasmo's equivalent output (~800 KB). For extensions where Chrome Web Store size limits matter, this gap is significant." Vite-based HMR works for content scripts, framework-agnostic. Plasmo is in apparent maintenance mode (the same comparison notes "active feature development has slowed significantly" and the team has shifted to commercial products). CRXJS is a Vite plugin not a framework. |
| Permissions | `activeTab`, `scripting`. **No** `host_permissions`. **No** `<all_urls>`. | activeTab grants per-click temporary access; this aligns with the "Summon, not always-on" rule and avoids Chrome Web Store rejection for over-permissioning. |
| Background | Service worker, ES modules, all listeners registered at top level (per Chrome's migrate-to-service-workers docs: "Registering a listener asynchronously (for example inside a promise or callback) is not guaranteed to work in Manifest V3"). No global state — everything in `chrome.storage.session`. | Service workers terminate after ~30s idle; alarms have a 30s minimum period. |
| Content script | Injected at click via `chrome.scripting.executeScript`. Extracts features locally. | Cross-origin DOM is not a problem at this layer because content scripts run in the page's origin. |
| Data leaving the browser | Only the **feature signature** (~2–4KB JSON: layout hash, palette, archetype guess, version_key, hero_box dimensions). | This satisfies "No raw page text/screenshots transmitted by default." |
| Sensitive page blocklist | Hard-coded list of patterns (`*.bank*`, `mail.google.com`, `*.healthcare.gov`, `accounts.*`, anything matching `password\|account\|wallet` in path) → extension refuses to summon. Plus a user toggle "block this site." | Eligibility tiers: Public (compile + ghost storage), Private (compile but no leaderboard/ghost), Block (refuse entirely). |
| Messaging | `chrome.runtime.sendMessage` with explicit `return true` for async — every JS extension dev who ignores this gets bitten. WebSocket from content script to backend keeps SW alive per Chrome 116 lifecycle rules. | |

**End-of-Phase-4 architecture:**

```
+-------------------+    user clicks icon
| Browser tab       | ─────────────────►  Service Worker  ──► chrome.scripting.executeScript()
| (any public URL)  |                      │
+-------------------+                      ▼
        ▲                          Content Script (Readability + DOM walker + EasyList + blocklist check)
        │                                  │
        │                                  ▼
        │                          POST signature → api.webwave/v1/summon
        │                                  │
        │                                  ▼  (cached level if version_key seen; otherwise dispatch compile job)
        │                          GET level_script.json from R2
        │                                  │
        ◄──── render Pixi overlay ─────────┘
              in shadow-DOM iframe
```

**Why a shadow-DOM iframe overlay, not full-page replacement:** preserves the source page underneath (visible at low opacity), reinforces "feels like the page," and avoids CSP conflicts on hosts with strict policies.

**Exit criteria:**
- Chrome Web Store approval on first or second submission.
- ≥1000 weekly summons.
- Zero CSP-related rendering failures across the top 200 visited domains.

**Intentionally deferred:** Atlas, Archive, Lens marketplace, Firefox/Safari ports (port last, after Chrome retention is proven).

**Cost:** Chrome Web Store: $5 one-time registration. Mozilla addons: free. Apple Safari: $99/yr Apple Developer Program — defer.

---

### Phase 5 — Atlas v0 + Ghost Layer v1 (6–8 weeks)

**Goal:** First social/discovery surface. Friend ghosts, AI benchmark bots, basic Atlas map.

**Atlas tech:**
- Atlas is a 2D tile-based "map of played pages." Render with PixiJS (you already have it) on a `Viewport`-style canvas.
- Tile data shape: each tile is a domain or domain-cluster, sized by play volume, colored by archetype dominance.
- Backend: continue Neon — keep Postgres for consistency with leaderboard schema. Add `atlas_tiles` materialized view refreshed hourly.
- Tile assets: pre-rendered as WebP from server-side `node-canvas` worker on Fly. Cache in R2; serve via Cloudflare CDN.

**Ghost Layer v1:**
- Friend ghosts (mutual follow only — defer public following).
- AI benchmark bots: pre-compute "median player" and "expert player" runs by playing each daily level headless with a deterministic policy. Store as ghost replays.
- Score curves: store per-session score-over-time as a downsampled array (60 samples max).

**Exit criteria:**
- Atlas page load <2s with 10k domains rendered.
- ≥40% of D7-retained users open Atlas at least once.

---

### Phase 6 — Archive Pillar (4–6 weeks)

**Goal:** Playable historical versions of pages, sourced from the Wayback Machine.

**Tech:**
- Wayback CDX API (`https://web.archive.org/cdx/search/cdx?url=...&output=json&collapse=timestamp:8`) to list snapshots, one per day max. The `collapse=timestamp:8` parameter is the canonical "one snapshot per day" trick documented in TinyUtils' 2025 Wayback API guide.
- Fetch the snapshot HTML via `https://web.archive.org/web/{timestamp}id_/{url}` (the `id_` modifier returns the original unmodified resource without Wayback's injected toolbar).
- Compiler runs on the snapshot exactly as on live pages. Version_key naturally distinguishes them.
- Be courteous: cache all CDX responses for 30 days in R2; never re-fetch the same snapshot twice. Use a polite `User-Agent` identifying WebWave.

**Schema additions:**

```sql
CREATE TABLE archive_snapshots (
  url_key       text,
  wayback_ts    text,
  fetched_at    timestamptz,
  level_id      uuid REFERENCES levels(id),
  PRIMARY KEY (url_key, wayback_ts)
);
```

**Exit criteria:**
- 50 historically significant URLs available as playable archived levels.
- "Play this page in 2010, 2015, 2020" UI shipped.

---

### Phase 7 — ML-Assisted Page Anatomy (4–8 weeks, optional)

**Goal:** Move from heuristic to learned page-region segmentation when heuristics start producing visible duds at scale.

**Stack:**
- HuggingFace `microsoft/markuplm-base-finetuned-websrc` (per the published checkpoints from Microsoft's 2021 paper, pre-trained on 24M Common Crawl pages with masked markup LM, node relation prediction, and title-page matching). Fine-tune on ~500 manually labeled WebWave pages with region labels: `hero | main | nav | sidebar | footer | ad | comments`.
- Run inference on Fly GPU machines (~$0.60/hr A10) or via HuggingFace Inference Endpoints.
- Compare against the heuristic compiler on the same 500 pages. Ship the model only if region-F1 improves meaningfully (target >0.97 vs Readability's 0.97 median — caveat: per the SIGIR'23 benchmark, ML extractors *underperformed* heuristics on complex pages, so this Phase may end with "heuristic wins, stop investing").
- Alternative: VIPS algorithm (Cai et al., Microsoft Research MSR-TR-2003-79), open-source Java port at `ParticleMedia/vips`. Vision-based, useful for graphical pages but requires a headed browser render — slow.

**Why this is Phase 7 not Phase 2:** The single most important learning from existing research is that heuristic extractors *win* on the messy long tail. Don't add ML before you've measured where heuristics fail.

---

### Phase 8 — Lens Studio MVP (8–12 weeks)

**Goal:** Allow a vetted set of creators to author *alternate compilers* — different mappings from page signals to verb parameters.

**The architectural rule stays inviolable:** AI does not generate gameplay code. A Lens is a JSON-configurable transformation: it picks which verb to use, which sensory mappings, which act sequences. Verbs themselves remain solo-dev-authored deterministic microgames.

**Tech:**
- Lens definition format: JSON Schema-validated transformation rules. ~200 lines of config per Lens.
- Sandboxed evaluation: lenses are pure functions of `(page_signal_bundle) → level_script_overrides`. No arbitrary JS. Use JSONata or a custom DSL.
- Creator console: SvelteKit subapp. Live preview compiler runs lens against 10 reference pages.
- Marketplace: defer payment infrastructure. Start with attribution + curated featuring. Roblox-style DevEx payouts are out of scope until you have ≥10k MAU.

**Exit criteria:** 20 hand-vetted creators, 100 published lenses, ≥10% of plays use a non-canonical lens.

---

### Phase 9 — Polish, Mobile App, Internationalization (open-ended)

PWA wrap for mobile (don't ship a native app first — Apple's review process is hostile to "browser game" framing). i18n via Svelte's i18n pattern. SEO landing pages per archetype.

---

## Cross-cutting technical specifics

### Caching architecture

```
Browser            →  Service Worker (extension)  →  Cloudflare CDN  →  Worker  →  Neon  →  R2
   ↓ IndexedDB              ↓ chrome.storage           ↓ Edge cache       ↓ KV (Upstash optional)
recent levels         signature → version_key map     30-day TTL on      hot leaderboards
                                                       compiled levels
```

- IndexedDB on client: store the last 50 played levels' replays and 200 ghost traces.
- Cloudflare KV (or Upstash Redis): hot leaderboard top-100 per day, 60s TTL.
- R2: cold storage for replays older than 7 days; signed URLs for ghost downloads.

### Real-time / ghost transport

**WebSocket on Cloudflare Durable Objects** for live sessions; **signed R2 URLs** for asynchronous ghost downloads. Server-sent events considered and rejected — WebSocket is bidirectional (we need event ingestion in real time) and SSE has worse Workers ergonomics. Polling is fine as a fallback for sessions <60s but adds load.

### Cost projections

| Scale | Workers | Neon | R2 | Anthropic | Other | Total/mo |
|---|---|---|---|---|---|---|
| 10 DAU | $0 (free) | $0 | $0 | $0 | $0 | **$0** |
| 1k DAU | $5 | $0–19 | $1–3 | $1–10 | Clerk $25 if paid | **$30–60** |
| 100k DAU | $20–50 | $69 (Neon Scale) | $30–80 | $30–150 (cached) | CDN $0 | **$150–350** |

The 100k DAU column assumes ~1MB ghost trace storage per user per day (worst case 100GB/day → R2 cost dominated by storage growth, not bandwidth, because egress is free). If you must, prune ghosts older than 30 days; storage stays bounded.

### Legal / business

- Single-member LLC formation when revenue or external funding crosses ~$1k/month or when you accept your first contributor. Filing in Delaware via Stripe Atlas is the indie-dev standard ($500); a home-state LLC is cheaper ($50–300 depending on state) but doesn't help with future investor preferences.
- Privacy policy and ToS are required for Chrome Web Store. Generate via Termly/iubenda (~$10/mo). Add a clear "we do not transmit page text by default" line.
- Copyright: the Atlas/Archive surfaces play user-visited public URLs. This is closer to in re Sega v Accolade and the Internet Archive's posture than to copyright infringement, but it's not zero risk. Mitigations: only store *signatures* of pages, never the rendered page itself; respect `noai`/`noindex` meta tags as opt-out signals; honor takedown requests within 24h.

### Open source projects to study (and where they apply)

| Project | What you borrow |
|---|---|
| `cwackerfuss/react-wordle` | `generateEmojiGrid()` shareable score pattern; localStorage-only stats; daily index `(today - epoch)/86400000` (server-side, in your case) |
| `petergeorgas/Wordle-API` | Server-side answer validation pattern — your replay-validation oracle. Quoted README: *"The whole point of this API is to allow you to create a Wordle clone that keeps the answer OFF of the user's computer."* |
| `mozilla/readability` | Direct dependency (Phase 1+) |
| `gorhill/uBlock` and `easylist/easylist` | Cosmetic filter syntax for ad/nav exclusion |
| `chromium/dom-distiller` / `markusmobius/go-domdistiller` | Reference for what "Chrome reader mode" considers content (F1 0.927 on Zyte's benchmark) |
| `microsoft/markuplm-large-finetuned-websrc` | Phase 7 fine-tune base |
| `internetarchive/wayback` | CDX API for Archive pillar |
| `benlikescode/geohub` and `codergautam/worldguessr` | Server-authoritative scoring patterns for spatial games (and a cautionary tale: `realapire/geoguessr-cheat` shows that anything leaked client-side is forgeable) |
| `wxt-dev/wxt` | Extension framework |
| `ClitherProject/Slither.io-Protocol` | How to design a compact binary input protocol if WebSocket throughput becomes a bottleneck |

---

## Recommendations

**Do this exactly, in this order:**

1. **Spend the next 2 weeks on Phase 0 only.** If after 14 days the page-as-level concept doesn't make you want to play your own builds, no amount of infrastructure will save the product.
2. **Lock the level-script schema in Phase 1 and never break it.** Treat it like a database migration. All version evolution goes through a `schema_version` bump with a forward-compatible reader.
3. **Build the daily ritual before the extension.** The web-only daily site is a smaller, faster validation; the extension layers on top of a proven Compiler and runtime.
4. **Default every component to "free tier" until something forces an upgrade.** Workers free → paid only when you cross 100k requests/day. Neon free → paid only when you cross 0.5GB per branch. R2 has a 10GB free tier that lasts a surprisingly long time.
5. **Do not adopt React.** SvelteKit's smaller bundle, server-first defaults, and progressive enhancement match a daily-ritual product better than React 19's hydration model. Solid is faster still but has thinner SSR ecosystem.
6. **Buy a custom domain in Phase 1, not Phase 2.** ~$12. Sets you up for OAuth callbacks and email deliverability later.
7. **Set up Sentry (free tier, 5k events/mo) on day one of Phase 2.** Game runtimes fail in ways print-debugging won't catch.
8. **Form an LLC at $1k MRR or first contributor**, whichever comes first.

**Benchmarks that would change these recommendations:**
- If Phase 0 fun-yield testing fails (≤3/10 friends play twice): pivot to a different verb or a different content source (RSS feeds? GitHub repos as levels?) before committing to the full plan.
- If Chrome Web Store rejects the extension twice in Phase 4 for permissions, downgrade scope to "Daily ritual only" and skip the extension permanently.
- If Cloudflare Workers' 30s CPU limit becomes a Compiler bottleneck (it shouldn't — the heavy work runs on Fly), evaluate Cloudflare Containers (beta as of early 2026) or move compile to Fly Machines entirely.
- If Anthropic Haiku pricing rises >25%, switch classification to Gemini 2.5 Flash-Lite ($0.10/$0.40 per Galaxy.ai's tracker), which is ~0.7× the price of GPT-4o-mini and adequate for archetype classification.

---

## Caveats

- **The fun-yield problem is genuinely unsolved by this plan.** Every technical choice above is correct *given* that page-as-level produces fun; nothing here proves that premise. Phase 0 is the only place this gets tested. Do not skip it.
- **MarkupLM is from 2021** but remains the SOTA reference cited in 2024–2025 papers; HuggingFace checkpoints have not been refreshed. If you depend on it in Phase 7, monitor for successor models (WebFormer, WIERT) and the Feb 2025 "Multi-Record Web Page Information Extraction From News Websites" approach (arXiv:2502.14625).
- **Wayback Machine API reliability is not under your control.** Cache aggressively in R2 and design the Archive UI to degrade gracefully when CDX is rate-limiting or down. The TinyUtils 2025 guide notes Archive-It's `/all` CDX endpoint is currently temporarily blocked due to DDoS activity — assume the public CDX server is similarly fragile.
- **NYT-style server-side answer validation is reportedly how modern Wordle works**, per community reverse-engineering writeups (sbplat/wordle README states "The answers are now calculated on the server side"), but I did not find a primary NYT engineering source confirming this — treat the design pattern as community-observed best practice, not vendor-endorsed.
- **The cost projections above are bottom-up estimates** with Anthropic, Cloudflare, and Neon's posted May 2026 pricing. Provider pricing has been stable through early 2026 (Anthropic notably held 4.6 family pricing flat from late-2025 launches) but is not contractually guaranteed.
- **Manifest V3 service worker lifecycle is still evolving** — Chrome 116 extended SW lifetimes for active WebSockets, and further changes are likely. Design the extension to tolerate SW termination at any moment (state in `chrome.storage`, listeners at top level, alarms over `setTimeout`).
- **Anti-cheat is a treadmill, not a destination.** The replay-validation design above defeats the Wordle-style "view source" attack and the score-forging attack, but a determined adversary can still proxy a real human's gameplay through a bot. Acceptable as long as the leaderboard is small and friend-graph anchored; revisit at >10k DAU.
- **Bevy/WASM was evaluated and rejected** for the runtime. WebAssembly is fast (the js13kgames writeup cites "within 10% of C/C++ performance and up to 120% faster than JavaScript in compute-heavy tasks"), but the Bevy WASM build is explicitly limited per the Unofficial Bevy Cheat Book: "Performance will be limited, as WebAssembly is slower than native code and does not currently support multithreading. Not all 3rd-party plugins are compatible." The asset+toolchain weight kills iteration speed for a solo dev. JavaScript + PixiJS keeps you in one language across shell, extension, runtime, and compiler — which is the right call until performance forces otherwise.