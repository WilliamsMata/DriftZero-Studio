import type {
  CampaignState,
  CostEntry,
  ProductAnchor,
} from '@/domain/entities/campaign';
import type { VideoDurationSeconds } from '@/domain/entities/model-capabilities';
import { createCompletedShotResult } from './mock-adapters';

export interface ShowcasePreset {
  id: string;
  name: string;
  description: string;
  imageModel: string;
  videoModel: string;
  durationSeconds: VideoDurationSeconds;
  campaign: CampaignState;
}

/** Anchor metadata that never belongs to the campaign state itself. */
export interface ProductAnchorOption extends ProductAnchor {
  defaultBrief?: string;
}

const PERFUME_BRIEF =
  'Luxury perfume launch with a golden-hour Dubai terrace narrative, macro label fidelity, and smooth HeyGen image-to-video transitions.';

const WATCH_BRIEF =
  'Chronos Apex GT launch: precision-engineering narrative on a midnight city terrace, tachymeter and blue-dial macro fidelity, and controlled slow-motion image-to-video moves that keep every marker sharp.';

function mockCostEntry(
  step: CostEntry['step'],
  model: string,
  note: string,
): CostEntry {
  return {
    step,
    model,
    costUsd: 0,
    note: `${note} (pre-baked mock fixture, $0 spend)`,
  };
}

const perfumeAnchor: ProductAnchor = {
  name: 'Oud Al-Sahara Elixir',
  category: 'Luxury Perfume',
  imageUrl: '/fixtures/perfume-anchor.jpeg',
};

const watchAnchor: ProductAnchor = {
  name: 'Chronos Apex GT',
  category: 'Chronograph Watch',
  imageUrl: '/fixtures/watch-anchor.jpeg',
};

const oudCampaign: CampaignState = {
  id: 'preset-oud-al-sahara',
  mode: 'mock',
  aspectRatio: '9:16',
  tone: 'luxury-editorial',
  product: perfumeAnchor,
  productDna:
    'Faceted amber crystal flacon with a brushed-gold collar and deep burgundy label; preserve the embossed Arabic-inspired ornament, exact serif wordmark, and warm specular highlights.',
  adCopy: {
    hook: 'The desert keeps its rarest bloom for dusk.',
    headline: 'Oud Al-Sahara — Wear the Golden Hour.',
    cta: 'Reserve the Limited Elixir',
  },
  shots: [
    {
      index: 1,
      role: 'hero-packshot',
      title: 'Hero Pedestal & Relighting',
      imagePrompt:
        'Shot 1 (hero-packshot): editorial studio packshot of the Oud Al-Sahara Elixir flacon on warm travertine stone, dramatic golden rim lighting, 85mm lens, exact label typography, subtle amber reflections',
      videoMotionPrompt:
        'Slow cinematic orbit push-in with a warm light sweep across the faceted crystal and gold collar',
    },
    {
      index: 2,
      role: 'lifestyle-context',
      title: 'Dubai Sunset Lifestyle',
      imagePrompt:
        'Shot 2 (lifestyle-context): the Oud Al-Sahara Elixir resting naturally on a luxury marble terrace overlooking the Dubai desert sunset, shallow depth of field, golden-hour haze, product label clearly readable',
      videoMotionPrompt:
        'Gentle handheld parallax drift with warm ambient breeze, silk fabric movement, and soft bokeh',
    },
    {
      index: 3,
      role: 'macro-finale',
      title: 'Macro Detail Finale',
      imagePrompt:
        'Shot 3 (macro-finale): extreme macro close-up of the Oud Al-Sahara Elixir label and gold collar with micro water droplets and specular highlights, dark luxury backdrop, razor sharp typography',
      videoMotionPrompt:
        'Smooth macro pull-back reveal with shimmering light particles and a final logo lockup',
    },
  ],
  results: [
    createCompletedShotResult(
      1,
      '/fixtures/oud-perfume/shot-1.jpeg',
      '9/10 product fidelity. No label or geometry defects detected.',
      {
        videoJobId: 'preset-oud-video-01',
        playbackUrl: '/fixtures/oud-perfume/shot-1.mp4',
      },
    ),
    createCompletedShotResult(
      2,
      '/fixtures/oud-perfume/shot-2.jpeg',
      'Self-healed after one auto-retry. 9/10 product fidelity. Slight label reflection distortion corrected with exact typography guidance.',
      {
        wasRetried: true,
        videoJobId: 'preset-oud-video-02',
        playbackUrl: '/fixtures/oud-perfume/shot-2.mp4',
      },
    ),
    createCompletedShotResult(
      3,
      '/fixtures/oud-perfume/shot-3.jpeg',
      '9/10 product fidelity. Macro label edges and gold collar geometry preserved.',
      {
        videoJobId: 'preset-oud-video-03',
        playbackUrl: '/fixtures/oud-perfume/shot-3.mp4',
      },
    ),
  ],
  ledger: {
    totalUsd: 0,
    maxBudgetUsd: 1.5,
    entries: [
      mockCostEntry(
        'director',
        'deepseek/deepseek-v4.1-flash',
        'Creative direction and storyboard blueprint',
      ),
      mockCostEntry('image', 'black-forest-labs/flux-3-image-klein', 'Shot 1 keyframe'),
      mockCostEntry('image', 'black-forest-labs/flux-3-image-klein', 'Shot 2 keyframe'),
      mockCostEntry(
        'image',
        'black-forest-labs/flux-3-image-klein',
        'Shot 2 keyframe auto-retry',
      ),
      mockCostEntry('image', 'black-forest-labs/flux-3-image-klein', 'Shot 3 keyframe'),
      mockCostEntry(
        'vision-qa',
        'deepseek/deepseek-v4.1-flash',
        'Shot 1 fidelity check',
      ),
      mockCostEntry(
        'vision-qa',
        'deepseek/deepseek-v4.1-flash',
        'Shot 2 fidelity check',
      ),
      mockCostEntry(
        'vision-qa',
        'deepseek/deepseek-v4.1-flash',
        'Shot 2 fidelity re-check after retry',
      ),
      mockCostEntry(
        'vision-qa',
        'deepseek/deepseek-v4.1-flash',
        'Shot 3 fidelity check',
      ),
      mockCostEntry('video', 'heygen/heygen-video-1', 'Shot 1 job'),
      mockCostEntry('video', 'heygen/heygen-video-1', 'Shot 2 job'),
      mockCostEntry('video', 'heygen/heygen-video-1', 'Shot 3 job'),
    ],
  },
};


export const SHOWCASE_PRESETS: readonly ShowcasePreset[] = [
  {
    id: 'oud-al-sahara',
    name: 'Oud Al-Sahara Elixir',
    description: PERFUME_BRIEF,
    imageModel: 'black-forest-labs/flux-3-image-klein',
    videoModel: 'heygen/heygen-video-1',
    durationSeconds: 5,
    campaign: oudCampaign,
  },
];

export const PRODUCT_ANCHOR_OPTIONS: readonly ProductAnchorOption[] = [
  { ...perfumeAnchor, defaultBrief: PERFUME_BRIEF },
  { ...watchAnchor, defaultBrief: WATCH_BRIEF },
];
