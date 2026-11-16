import type { AspectRatio, BrandTone } from '@/domain/entities/campaign';
import {
  ASPECT_RATIO_DIRECTION,
  BRAND_TONE_DIRECTION,
} from './brand-direction';

export interface KeyframePromptInput {
  /** Scene, subject, camera, lighting, and mood written by the director. */
  creativeDirection: string;
  /** Product identity transcribed from the anchor image by the director. */
  productDna: string;
  tone: BrandTone;
  aspectRatio: AspectRatio;
  /** Extra instruction for the single Vision QA repair attempt. */
  correctiveFeedback?: string;
}

const FIDELITY_RULES = [
  '- Match the supplied product reference image exactly: silhouette, proportions, colors, materials, finish, logo placement, and label text.',
  '- Do not redesign, recolor, restyle, relabel, replace, or merge the product with another object.',
  '- Adapt the scene, props, lighting, and composition to the product; never change the product to fit the scene.',
  "- Do not add text overlays, captions, watermarks, or invented logos. Only the product's own label text may appear.",
  '- Keep the product as the hero of the frame and fully visible unless the shot is explicitly a macro detail.',
].join('\n');

/**
 * Builds the exact prompt sent to the image model.
 *
 * The creative director writes the scene, but product identity is injected
 * deterministically from `productDna`. This keeps every keyframe anchored to
 * the same reference even when the LLM omits details or drifts.
 */
export function buildKeyframePrompt(input: KeyframePromptInput): string {
  const sections = [
    input.creativeDirection.trim(),
    '',
    'PRODUCT IDENTITY (must match the supplied product reference image exactly):',
    input.productDna.trim(),
    '',
    'NON-NEGOTIABLE FIDELITY RULES:',
    FIDELITY_RULES,
  ];

  const corrective = input.correctiveFeedback?.trim();
  if (corrective !== undefined && corrective !== '') {
    sections.push(
      '',
      'CORRECTIONS REQUIRED FROM PRODUCT-FIDELITY QA:',
      corrective,
    );
  }

  sections.push(
    '',
    `ART DIRECTION: ${BRAND_TONE_DIRECTION[input.tone]}`,
    `FRAME: ${ASPECT_RATIO_DIRECTION[input.aspectRatio]}.`,
  );

  return sections.join('\n');
}

/**
 * Appends identity-preservation rules to the camera-motion prompt used by
 * image-to-video. The first frame already contains the product, so the motion
 * prompt must not invite morphing, relabeling, or new objects.
 */
export function buildVideoMotionPrompt(motionPrompt: string): string {
  return [
    motionPrompt.trim(),
    '',
    'PRODUCT FIDELITY RULES FOR MOTION:',
    '- The product must remain exactly as shown in the first frame: same silhouette, proportions, colors, materials, logo placement, and label text.',
    '- Do not morph, warp, recolor, relabel, replace, or duplicate the product.',
    '- Do not add text overlays, captions, watermarks, or new logos.',
  ].join('\n');
}
