# Model Configuration

DriftZero Studio routes each pipeline stage to a different OpenRouter model.
The four campaign stages are selectable from the frontend for every campaign.
The creative-brief model is server-side and optimized for fast drafts.
Environment variables only define the initial defaults.

## Model routing

| Stage | Port | Adapter | Environment default | Built-in default |
| --- | --- | --- | --- | --- |
| Campaign planning (text + anchor image) | `CreativeDirectorPort.planCampaign` | `OpenRouterDirectorAdapter` | `OPENROUTER_TEXT_MODEL` | `deepseek/deepseek-v4.1-flash` |
| Creative brief (text only) | `CreativeDirectorPort.draftBrief` | `OpenRouterDirectorAdapter` | `OPENROUTER_BRIEF_MODEL` | `meta/muse-ember` |
| Product-fidelity QA (image in, JSON out) | `VisionQaPort` | `OpenRouterVisionQaAdapter` | `OPENROUTER_VISION_QA_MODEL` | `deepseek/deepseek-v4.1-flash` |
| Keyframe generation | `ImageGenPort` | `OpenRouterImageAdapter` | `OPENROUTER_IMAGE_MODEL` | `black-forest-labs/flux-3-image-klein` |
| Image-to-video | `VideoGenPort` | `OpenRouterVideoAdapter` | `OPENROUTER_VIDEO_MODEL` | `heygen/heygen-video-1` |

The frontend sends `textModel`, `visionModel`, `imageModel`, `videoModel`, and
`durationSeconds` with each run. The environment values are used only when a
request omits a model, so the UI selection always wins. The brief endpoint never
receives a model from the frontend: it always uses `OPENROUTER_BRIEF_MODEL` (or
the built-in `meta/muse-ember`) so one-click drafts stay fast even when the
selected director model is slow.

Both the text model and the Vision QA model must accept image input. The
creative director receives the product anchor photo with every planning call;
text-only models are excluded from the selector and rejected by the API. The
brief is text-only, so its model may be text-only.

## Audio

Video models differ in how they handle audio, and the studio adapts the request
to each capability:

| `audioMode` | Behavior | Request |
| --- | --- | --- |
| `always` | Audio is always rendered; the provider rejects `generate_audio` | Flag omitted (e.g. HeyGen Video 1) |
| `optional` | `generate_audio` is supported | `generate_audio: true` |
| `none` | The model never renders audio | Flag omitted |
| `unknown` | Provider does not advertise it | Flag omitted |

Audio can change the price. Veo 3.1 doubles its per-second cost with audio
($0.20 → $0.40 at 720p), while Seedance, Wan and HeyGen include it in the same
SKU. `estimatedCostPerSecondUsd` always reflects the audio-inclusive price when
the model supports audio, so the estimate card and `BudgetGuardrail` stay
honest.

The curated snapshot encodes `audioMode` per model; `?refresh=true` upgrades a
model to `optional` when OpenRouter reports `generate_audio: true`, and keeps
the curated `always`/`none` value otherwise.

## Reasoning and output limits

Chat requests deliberately omit `max_tokens`. Capping output caused reasoning
models to spend the whole budget thinking and return empty or truncated JSON;
letting the model finish is cheaper than retrying a broken plan.

Reasoning effort is per model via the optional `reasoningEffort` field in
`models-snapshot.json` (`minimal`, `low`, `medium`, or `high`). Models without
the field use `low`. `meta/muse-ember` is configured as `high` because it
degrades badly at low effort; that also makes it a poor fit for the low-latency
director role, but an excellent brief drafter.

## Frontend selector

The "Capability-Aware Models" panel contains four selectors:

1. **Text Model** — creative director. Must accept image input; the product
   anchor is attached to every planning call.
2. **Vision QA Model** — must accept image input.
3. **Image Model** — must accept at least one product reference for zero-drift.
4. **Video Model** — image-to-video. The clip-length slider uses the model's
   minimum supported duration as the left bound and caps at 10 seconds. Models
   with discrete durations (for example Veo at 4/6/8s) use a step that only
   lands on supported values.

The Creative Brief panel's AI button is separate: it calls
`OPENROUTER_BRIEF_MODEL` server-side so a slow director model never delays a
one-click draft. The generated brief is shown with its model and cost in a
toast.

Below the selectors, the "Estimated full run" card shows the combination cost:

- text plan × 1
- Vision QA × selected shot count (1–5)
- keyframes × selected shot count
- video × selected shot count at the selected clip length
- worst case with one Vision QA retry per shot (which also regenerates one
  image per shot)

`mock` shows $0. `hybrid` excludes video because video stays mocked. `live`
includes every stage. The estimate is approximate; actual spend is read from
OpenRouter's `usage.cost` and written to the campaign ledger.

## Prompt fidelity contract

The creative director writes the scene, camera, lighting, and mood for each
shot, but it never writes the final image prompt in isolation:

1. The director receives the product anchor image as multimodal input and
   transcribes `productDna` from it. If the product name conflicts with the
   image, the image wins.
2. The application composes the exact image prompt with
   `buildKeyframePrompt`: creative direction + `productDna` + non-negotiable
   identity rules + brand tone + frame direction. This composition happens at
   the keyframe-generation boundary, so planned campaigns, presets, and direct
   API callers all receive the same protection.
3. Vision QA receives the creative direction and `productDna`, not the composed
   prompt. When it requests a repair, the application replaces the creative
   direction with the refined one and re-applies the identity lock; QA defects
   are added as explicit corrections.
4. Video motion prompts receive `buildVideoMotionPrompt`, which forbids
   morphing, recoloring, relabeling, replacing the product, or adding text.
5. The exact keyframe prompt sent to the image model is stored in
   `ShotResult.imagePromptUsed` and shown in the storyboard's "Prompt sent"
   section.

## Quick start

```dotenv
MEDIA_EXECUTION_MODE=hybrid
OPENROUTER_API_KEY=sk-or-v1-...

OPENROUTER_TEXT_MODEL=deepseek/deepseek-v4.1-flash
OPENROUTER_VISION_QA_MODEL=deepseek/deepseek-v4.1-flash
OPENROUTER_BRIEF_MODEL=meta/muse-ember
OPENROUTER_IMAGE_MODEL=black-forest-labs/flux-3-image-klein
OPENROUTER_VIDEO_MODEL=heygen/heygen-video-1
```

`OPENROUTER_TEXT_MODEL` and `OPENROUTER_VISION_QA_MODEL` must both accept image
input. `OPENROUTER_BRIEF_MODEL` may be text-only. If a configured model is
unknown or lacks the required capability, the catalog falls back to the built-in
default and logs a warning.

Execution modes:

- `mock`: everything simulated, $0.
- `hybrid`: real text, image, and Vision QA calls; video stays mocked.
- `live`: text, image, vision QA, and video all call OpenRouter.

## Cost assumptions

The server reserves budget before each call using these token assumptions:

| Stage | Input tokens | Output tokens |
| --- | ---: | ---: |
| Creative director (text + anchor image) | 6,000 | 1,500 |
| Creative brief (text only) | 800 | 400 |
| Vision QA | 4,000 | 400 |

The UI uses the same assumptions. Text pricing is stored in
`models-snapshot.json` as USD per one million input/output tokens. Image pricing
is USD per image and video pricing is USD per second. The image/video live
refresh (`/api/models?refresh=true`) updates those two catalogs; chat pricing is
curated in the snapshot.

The token counts are pre-flight reservations only. Chat requests do not send a
`max_tokens` cap, so the actual output (including reasoning) can exceed the
reservation; the guardrail checks actual spend again after the call.

## Adding a new image or video model

The live refresh only enriches models that already exist in
`models-snapshot.json`; it never appends new entries. Add the model to the
snapshot first.

Chat model entry:

```json
{
  "id": "vendor/chat-model",
  "label": "Human Readable Name",
  "provider": "Vendor",
  "inputCostPerMillionUsd": 0.1,
  "outputCostPerMillionUsd": 0.5,
  "supportsVision": true,
  "reasoningEffort": "low"
}
```

`reasoningEffort` is optional. Omit it for the default `low`; set `"high"` for
models such as `meta/muse-ember` that perform poorly at low effort.

Image entry:

```json
{
  "id": "vendor/model-id",
  "label": "Human Readable Name",
  "provider": "Vendor",
  "supportedAspectRatios": ["9:16", "16:9"],
  "supportsInputReferences": true,
  "maxInputReferences": 4,
  "estimatedCostPerImageUsd": 0.02
}
```

Video entry:

```json
{
  "id": "vendor/video-model-id",
  "label": "Human Readable Name",
  "provider": "Vendor",
  "supportedAspectRatios": ["9:16", "16:9"],
  "supportsInputReferences": false,
  "maxInputReferences": 0,
  "supportedDurations": [4, 5, 6, 7, 8, 9, 10],
  "supportedResolutions": ["480p", "720p"],
  "supportedFrameImages": ["first_frame", "last_frame"],
  "supportsLastFrame": true,
  "estimatedCostPerSecondUsd": 0.03
}
```

Rules enforced by the application:

- Aspect ratios are limited to `9:16`, `16:9`, and `1:1`.
- Durations are integers from `1` to `10` seconds (`VideoDurationSeconds`), and
  must be listed in the selected model's `supportedDurations`.
- Image-to-video requires `first_frame` support.
- Last-frame transitions require `supportsLastFrame: true`.
- Vision QA requires a model with `supportsVision: true`.
- Creative direction requires a model with `supportsVision: true`; the product
  anchor image is part of the planning request.
- `estimatedCostPerImageUsd` and `estimatedCostPerSecondUsd` feed
  `BudgetGuardrail`; keep them conservative.
- Vision QA retries are hard-capped at `1` per shot.

## Current catalog reference (checked 2026-11-16)

These are OpenRouter list prices and can change; verify before a live spend.

### Text and vision

| Model ID | $/M input | $/M output | Vision | Notes |
| --- | ---: | ---: | --- | --- |
| `meta/muse-ember` | 0.10 | 0.50 | Yes | Fast brief drafter; `reasoningEffort: high` |
| `deepseek/deepseek-v4.1-flash` | 0.0507 | 0.2028 | Yes | Default; cheapest vision-capable option |
| `anthropic/claude-haiku-5.5` | 0.10 | 0.50 | Yes | Strong cheap all-rounder |
| `openai/gpt-6-luna-pro` | 0.10 | 0.50 | Yes | Cheap, reliable JSON |
| `qwen/qwen3.8-omni-flash` | 0.15 | 0.47 | Yes | Budget multimodal |
| `google/gemini-2.5-flash` | 0.30 | 2.50 | Yes | Previous project default |
| `google/gemini-3.5-flash-lite` | 0.30 | 2.50 | Yes | Newer 2.5 Flash replacement |
| `google/gemini-3.8-flash` | 0.825 | 4.125 | Yes | Higher-quality planning |
| `openai/gpt-6.1-terra` | 1.00 | 5.00 | Yes | Premium planning |
| `anthropic/claude-sonnet-5.5` | 2.00 | 10.00 | Yes | Premium planning |
| `google/gemini-4-hydrogen` | 1.50 | 7.50 | Yes | Top-tier multimodal |
| `z-ai/glm-5.3-flash` | 0.0399 | 0.0784 | No | Text-only; cannot run planning or Vision QA |

### Image generation

| Model ID | $/image | Max reference images | Notes |
| --- | ---: | ---: | --- |
| `black-forest-labs/flux-3-image-klein` | 0.008 | 10 | Cheapest usable option |
| `bytedance-seed/seedream-5-0-flash` | 0.018 | 14 | Very cheap, many references |
| `bytedance-seed/seedream-5-5` | 0.02 | 10 | Balanced quality/price |
| `google/gemini-nano-banana-2.1` | 0.04 | 14 | Best Google fidelity/editing; 1K list price is 0.0336 |

`meta/muse-image` is listed in OpenRouter's image catalog but currently exposes
zero endpoints, so it cannot be selected or priced. FLUX 3 Image is the default
instead.

### Video generation

| Model ID | $/second | Frame images | Supported clips | Notes |
| --- | ---: | --- | ---: | --- |
| `heygen/heygen-video-1` | 0.02 (480p) | first | 5–10s | Default; 5s minimum |
| `x-ai/grok-imagine-video-1.5-lite` | 0.02 (480p), 0.03 (720p) | first | 1–10s | Cheap and flexible |
| `google/veo-3.1-lite` | 0.03 (720p, no audio) | first + last | 4/6/8s | Previous catalog entry |
| `bytedance/seedance-2.0-fast` | token-based; ~0.03 estimate | first + last | 4–10s | Previous project default |
| `alibaba/wan-3.0` | 0.05 (480p), 0.10 (720p) | first + last | 2–10s | Long clips |
| `minimax/hailuo-3-max` | 0.05 (480p), 0.08 (768p) | first + last | 5–10s | Quality tier |
| `google/gemini-omni-1.2-flash` | 0.07 (720p) | first + last | 3–10s | Native audio |
| `google/veo-3.1-fast` | 0.08 (720p, no audio) | first + last | 4/6/8s | Faster Veo |
| `google/veo-3.1` | 0.20 (720p, no audio) | first + last | 4/6/8s | Premium Veo |

The application caps clip length at 10 seconds. The slider starts at the
model's minimum supported duration and uses a step derived from its supported
values, so Veo jumps 4 → 6 → 8 while HeyGen moves in 1-second increments from
5 to 10.

## Inspecting the live OpenRouter catalog

```bash
# Chat / text models
curl -s https://openrouter.ai/api/v1/models \
  | jq -r '.data[] | [.id, .pricing.prompt, .pricing.completion] | @csv'

# Image models and their input-reference limits
curl -s https://openrouter.ai/api/v1/images/models \
  | jq -r '.data[] | [.id, (.supported_parameters.input_references|tostring)] | @csv'

# Per-image price for one model
curl -s https://openrouter.ai/api/v1/images/models/<vendor>/<model>/endpoints \
  | jq '.endpoints[].pricing[] | select(.billable=="output_image")'

# Video models, durations, frame images, and pricing SKUs
curl -s https://openrouter.ai/api/v1/videos/models \
  | jq -r '.data[] | [.id, (.supported_durations|map(tostring)|join(",")), (.pricing_skus|tostring)] | @csv'
```
