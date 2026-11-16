# Deployment and media storage

How DriftZero Studio stores generated assets, and what must be configured before
deploying to Vercel (or any other Node host).

## 1. Storage architecture

Every file operation goes through `AssetStoragePort`
(`src/domain/ports/media-ports.ts`). `createAssetStorage()` in
`src/infrastructure/config/provider-factory.ts` picks the adapter:

| Condition | Adapter | Behaviour |
| --- | --- | --- |
| `mode === "mock"` | `MockAssetStorageAdapter` | Nothing is written. Returns fixture URLs. |
| `BLOB_READ_WRITE_TOKEN` set | `VercelBlobStorageAdapter` | Uploads to Vercel Blob and returns public HTTPS URLs. |
| No token (hybrid/live) | `HybridLocalStorageAdapter` | Writes to `public/generated/` on the local filesystem. |

`public/generated/` is gitignored and is **only** valid on a local machine.
Vercel's deployment filesystem is read-only, so a deployed `hybrid` or `live`
run without a Blob token fails while writing keyframes.

## 2. What is stored where

| Asset | `mock` | `hybrid` / `live` without token | With Blob token |
| --- | --- | --- | --- |
| Product anchor upload | Data URI | Data URI (local disk only in `live`) | Blob `generated/...` |
| Generated keyframes | Fixture URL | `public/generated/<campaign>-shot-N.png` | Blob `generated/...` |
| Video first/last frames | n/a (video mocked) | Local path (rejected by live video) | Blob `campaign-assets/...` |
| Rendered videos | Not stored | Not stored | Not stored |

Videos are never copied into Blob. OpenRouter jobs are streamed to the browser
through `GET /api/videos/[jobId]/content`, which injects the API key and keeps
provider URLs private.

## 3. Required environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `MEDIA_EXECUTION_MODE` | No | `mock` (default), `hybrid`, or `live`. The studio mode selector overrides it per campaign. |
| `OPENROUTER_API_KEY` | For hybrid/live | Server-only. Never expose it to the browser. |
| `BLOB_READ_WRITE_TOKEN` | For deploy with real media | Created by Vercel Blob. Server-only. Works from any host, not just Vercel. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin used for OpenRouter's `HTTP-Referer` header. |
| `MAX_CAMPAIGN_BUDGET_USD` | Recommended | Default `1.50`. Enforced by `BudgetGuardrail`. |
| `MAX_VISION_QA_RETRIES` | Recommended | Hard-capped at `1` by the application. |
| `OPENROUTER_*_MODEL` | No | Defaults live in `.env.example` and can be overridden per campaign. |

## 4. Vercel Blob setup

1. Vercel dashboard → project → **Storage** → **Create** → **Blob**.
2. Choose **public** access. The adapters upload with `access: "public"`.
3. **Connect** the store to the project. Vercel injects
   `BLOB_READ_WRITE_TOKEN` into Production, Preview, and Development.
4. Pull the token for local runs:

   ```bash
   vercel link
   vercel env pull .env.local
   ```

5. Verify the token (upload, public read, delete):

   ```bash
   node --env-file=.env.local -e "
   const { put, del } = await import('@vercel/blob');
   const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
   const blob = await put('generated/check.png', png, { access: 'public', contentType: 'image/png', addRandomSuffix: true });
   const res = await fetch(blob.url);
   console.log(blob.url, res.status, res.headers.get('content-type'));
   await del(blob.url);
   "
   ```

## 5. Function duration limits

Vercel Functions default to **300 s** and are capped at **300 s on Hobby**
(800 s on Pro, as of 2026). The original keyframe endpoint generated all shots
in one request, which could exceed that budget on a 5-shot campaign with Vision
QA retries.

The studio now sends **one request per shot** (`shotIndexes: [n]`) and keeps the
campaign state in sync between calls. Each invocation runs at most:

```
image generation (120 s client timeout) + Vision QA + one repair attempt
```

That stays comfortably inside the 300 s window, and the UI paints each keyframe
as soon as it lands. `export const maxDuration = 300` is set explicitly on
`/api/campaigns/keyframes` and `/api/campaigns/videos`.

Video submission is already cheap in `live` mode: keyframes are public Blob
URLs, so no upload happens before the OpenRouter job is created. Long-running
video work is polled from `/api/videos/[jobId]/status` and never blocks a
request.

### If you need longer work

- `waitUntil` from `@vercel/functions` keeps work alive only up to the function's
  `maxDuration`; it does not extend it. Do not use it to bypass the limit.
- Vercel Workflows/Queues provide durable background execution but require
  additional infrastructure and a datastore.
- Railway (or any long-lived Node host) removes the per-request limit entirely.
  The trade-off is that video generation still polls OpenRouter jobs, so the
  client must stay open or state must be persisted server-side either way.

## 6. Railway deployment

The app is a standard Next.js server and runs on Railway without code changes:

1. Create a project from the repository.
2. Build command: `pnpm build`; start command: `pnpm start`.
3. Add `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and
   `NEXT_PUBLIC_APP_URL=https://<railway-domain>`.
4. Keep `public/` writable only if you intentionally run without Blob; on
   Railway the filesystem is ephemeral across deploys, so Blob is still the
   correct place for generated media.

## 7. Operational caveats

- **No blob cleanup yet.** Every run creates new objects (`addRandomSuffix:
  true`) and nothing deletes them. Add a scheduled cleanup (Vercel Cron or a
  Railway cron) before running high-volume campaigns.
- **Public keyframes.** Generated images are public Blob URLs and are rendered
  directly in the studio. Do not upload confidential product material.
- **Request body limit.** Vercel rejects request bodies above 4.5 MB. Product
  uploads are capped at 3 MB, and `hybrid` runs persist the anchor to Blob when
  a token is available so the campaign payload never carries a multi-MB data
  URI.
- **No server-side campaign persistence.** The campaign lives in the client
  store. Refreshing the page loses job IDs and campaign state even though the
  blobs remain.
- **Budget guardrail.** Every image and video step is preflighted against
  `maxBudgetUsd`; a failed preflight returns HTTP 402 before any provider call.
