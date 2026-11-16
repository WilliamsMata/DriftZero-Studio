# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Evaluators (primary):** hiring managers and engineers assessing the author's ability to design and ship AI media software. They arrive cold, expect to judge in one sitting, and care about architecture, guardrails, and code discipline more than marketing polish.

**Operator (secondary):** the author, running the studio locally to demonstrate or extend it. Single user, no accounts.

## Product Purpose

DriftZero Studio turns one product photo into a planned, multi-shot short-form ad — hero packshot, lifestyle context, macro finale — with image keyframes, a fidelity check, and image-to-video renders. Its purpose as a portfolio piece is to prove the pipeline is real: an evaluator should be able to see the fidelity mechanism, the cost enforcement, and the architecture working in the browser, with no API key and no spend.

Success means an evaluator can complete a preset campaign end to end, inspect why each stage exists and what it cost, and leave believing the author has shipped production-shaped AI media infrastructure rather than a mockup.

## Positioning

**Zero-drift product fidelity.** The real product is the non-negotiable artifact: its photo is passed as an anchor reference into every keyframe, each keyframe is scored against that anchor by Vision QA, one automatic repair attempt is allowed, and only an approved frame is used to start the video job. A neighboring demo can show generated clips; this one can show that the product itself stayed intact, shot by shot, with the check and its cost visible.

## Operating Context

- Evaluators use a browser against a locally served build (`pnpm dev`), often while reading the source and `AGENTS.md` alongside it.
- The studio is a single-screen workspace: configuration on the left, storyboard in the middle, ad player and cost ledger on the right.
- Preset campaigns let a visitor load a complete, pre-rendered storyboard without generating anything.
- Execution is staged (plan → keyframes → videos) and can be run whole or step by step.
- The project is presented as a working phase of an ongoing build, not a finished commercial product.

## Capabilities and Constraints

- Execution modes: `mock` (fully simulated, $0), `hybrid` (real LLM and images, mock video), `live` (all OpenRouter media). Mock is the default and the mode a visitor sees without configuration.
- Campaigns support 1–5 shots (default 3). Each shot maps 1:1 to one keyframe and one image-to-video clip. The role sequence is hero packshot for shot 1, macro finale for the last shot, and lifestyle beats in between. Aspect ratios: 9:16, 16:9, 1:1, validated against the selected models' capabilities. Brand tones: luxury editorial, TikTok UGC, minimalist studio.
- A server-side model catalog supplies capability and pricing metadata for text, vision, image, and video models. All four are selectable in the UI, and the config panel shows an approximate cost for the selected combination before any spend.
- `BudgetGuardrail` pre-reserves every media step and blocks the run when the campaign total would exceed the cap. Default cap is $1.50 per campaign; the total media budget for the project is $10 USD. Vision QA retries are hard-capped at 1 per shot.
- Media stays server-side: the browser never receives provider keys or unsigned provider URLs; video plays through a server proxy or public blob storage.
- Strict hexagonal architecture: domain and application layers hold no React, Next, or SDK imports; Route Handlers delegate to use cases. TypeScript `strict`, zero `any`.
- All code, comments, types, UI copy, and tests are in English.
- Durable constraints confirmed by the owner: local single-user with no auth, the $10 media budget, the 1–5 shot structure (one repair attempt per shot), and server-proxied media only.
- Undecided: whether the demo is ever run in `live` mode with real spend, and whether campaign state should persist beyond a session.

## Brand Commitments

- Name: **DriftZero Studio**. "Drift" refers to product fidelity drift in generated media, not to visual style.
- Voice: precise, engineering-literate, and candid about limits — states what is simulated and what is real. No marketing superlatives, no invented scale.
- The product is a studio for making product ads; it must not be presented as a general-purpose video platform or a design tool.

## Evidence on Hand

- Two committed preset campaigns with finished fixture media: `oud-perfume` (Oud Al-Sahara Elixir) and `chronos-watch` (Chronos Apex GT), under `public/fixtures/`.
- Product anchor photos for both presets, plus a sample clip.
- Four application test suites covering the budget guardrail, capability validation, keyframe QA, and mock video lifecycle.
- Absent, and not to be fabricated by future work: real OpenRouter-generated campaigns, clients, testimonials, benchmark timings, pricing, licensing terms, or deployment claims.

## Product Principles

1. **Fidelity over flair.** A beautiful shot that changes the product is a failure. Every stage exists to keep the real artifact intact.
2. **Price the work before doing it.** Every generation step declares its cost against a visible cap; nothing runs on an invisible budget.
3. **Show the mechanism, not the claim.** The demo earns trust by exposing the fidelity check, the ledger, and the architecture, not by asserting quality.
4. **Simulate first, spend last.** The default path is free and complete, so the story survives contact with a visitor who has no key.
5. **Preserve the constraint under pressure.** Three shots, one repair, a hard cap, a proxy — the limits are the product's credibility, not obstacles to route around.
