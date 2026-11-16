import type { AspectRatio, BrandTone } from '@/domain/entities/campaign';

/**
 * Concrete art-direction guidance shared by the creative director and the
 * deterministic image-prompt composition.
 */
export const BRAND_TONE_DIRECTION: Readonly<Record<BrandTone, string>> = {
  'luxury-editorial':
    'Restrained cinematic luxury: warm controlled light, premium materials, generous negative space, editorial composition.',
  'tiktok-ugc':
    'Native social energy: handheld framing, fast visual hooks, authentic creator pacing, dynamic crops.',
  'minimalist-studio':
    'Quiet architectural minimalism: clean geometry, soft directional light, precise product blocking.',
};

export const ASPECT_RATIO_DIRECTION: Readonly<Record<AspectRatio, string>> = {
  '9:16': 'vertical 9:16 frame',
  '16:9': 'horizontal 16:9 frame',
  '1:1': 'square 1:1 frame',
};
