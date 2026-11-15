<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DriftZero Studio — Architecture, Cost & OpenRouter Rules

## 1. Strict Hexagonal Architecture
- `src/domain/` MUST NOT import anything from `react`, `next`, `@openrouter/sdk`, `@vercel/blob`, or `src/infrastructure/`.
- `src/application/` may only depend on `src/domain/` and `zod`.
- All external integrations (OpenRouter, Vercel Blob, local mocks, JSON caches) live strictly inside `src/infrastructure/`.
- Never put business logic, prompt engineering, or raw `fetch` calls to AI providers inside React components or Route Handlers; Route Handlers must delegate to Application Use Cases.

## 2. Anti-Burn Credit Rules ($10 USD Total Budget)
- Default mode is `MEDIA_EXECUTION_MODE=mock`. NEVER call live OpenRouter APIs from `vitest` tests, React Server Components, or during component renders.
- Every media generation step MUST go through `BudgetGuardrail` before execution and throw `BudgetGuardrailError` if `currentTotalUsd + estimatedCostUsd > maxBudgetUsd` (default `MAX_CAMPAIGN_BUDGET_USD=1.50`).
- `MAX_VISION_QA_RETRIES` MUST NEVER exceed `1` per shot.

## 3. OpenRouter Media Integration Rules
- **Images (`POST https://openrouter.ai/api/v1/images`)**: Returns `data[0].b64_json` and `usage.cost`. Always pass product anchor reference(s) via `input_references` when supported by the selected model.
- **Videos (`POST https://openrouter.ai/api/v1/videos`)**: Asynchronous (`jobId` -> polling). `frame_images` (`first_frame` / `last_frame`) MUST be public HTTPS URLs (`200 OK`, `Content-Type: image/...`) — never `localhost` or `data:` URIs. In `live` mode, persist keyframes via `AssetStoragePort` before submitting video jobs.
- **Security Proxy**: The browser MUST NEVER call OpenRouter directly or receive `OPENROUTER_API_KEY` or raw unsigned URLs. `<video>` playback in `live` mode must go through `GET /api/videos/[jobId]/content` (server-side proxy) or cached public blob storage.
- **Model Capabilities**: Always validate requested `aspectRatio`, `durationSeconds`, `input_references`, and `last_frame` support against the model's capability metadata before execution.

## 4. Engineering & UI Standards
- Language: All code, comments, types, UI copy, and tests must be in **English**.
- TypeScript `strict: true` — zero `any`, zero `@ts-ignore`.
- UI: `shadcn/ui` (dark studio aesthetic), `lucide-react` icons, `sonner` toasts, `zustand` for client studio state.
- Always run `npx tsc --noEmit` and `pnpm vitest run` before considering a task complete.
