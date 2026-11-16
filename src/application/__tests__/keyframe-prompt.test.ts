import { describe, expect, it } from 'vitest';
import {
  buildKeyframePrompt,
  buildVideoMotionPrompt,
} from '@/application/services/keyframe-prompt';

const baseInput = {
  creativeDirection:
    'Hero packshot on warm travertine stone with an 85mm lens and golden rim light.',
  productDna:
    'Faceted amber glass flacon, brushed gold collar, deep burgundy label with serif wordmark.',
  tone: 'luxury-editorial' as const,
  aspectRatio: '9:16' as const,
};

describe('buildKeyframePrompt', () => {
  it('injects product identity, fidelity rules, tone, and frame direction', () => {
    const prompt = buildKeyframePrompt(baseInput);

    expect(prompt).toContain(baseInput.creativeDirection);
    expect(prompt).toContain(baseInput.productDna);
    expect(prompt).toContain('NON-NEGOTIABLE FIDELITY RULES');
    expect(prompt).toContain('Do not redesign, recolor, restyle, relabel, replace');
    expect(prompt).toContain('Do not add text overlays, captions, watermarks');
    expect(prompt).toContain('ART DIRECTION: Restrained cinematic luxury');
    expect(prompt).toContain('FRAME: vertical 9:16 frame');
    expect(prompt).not.toContain('CORRECTIONS REQUIRED');
  });

  it('adds QA correction guidance without dropping the identity lock', () => {
    const prompt = buildKeyframePrompt({
      ...baseInput,
      correctiveFeedback:
        'Eliminate these defects from the previous keyframe: softened label text.',
    });

    expect(prompt).toContain('CORRECTIONS REQUIRED FROM PRODUCT-FIDELITY QA');
    expect(prompt).toContain('softened label text');
    expect(prompt).toContain(baseInput.productDna);
    expect(prompt).toContain('NON-NEGOTIABLE FIDELITY RULES');
  });

  it('uses the requested frame direction for horizontal and square campaigns', () => {
    expect(
      buildKeyframePrompt({ ...baseInput, aspectRatio: '16:9' }),
    ).toContain('FRAME: horizontal 16:9 frame');
    expect(
      buildKeyframePrompt({ ...baseInput, aspectRatio: '1:1' }),
    ).toContain('FRAME: square 1:1 frame');
  });
});

describe('buildVideoMotionPrompt', () => {
  it('appends identity-preservation rules to camera motion', () => {
    const prompt = buildVideoMotionPrompt(
      'Slow cinematic orbit push-in with a warm light sweep.',
    );

    expect(prompt).toContain('Slow cinematic orbit push-in');
    expect(prompt).toContain('PRODUCT FIDELITY RULES FOR MOTION');
    expect(prompt).toContain('Do not morph, warp, recolor, relabel, replace');
    expect(prompt).toContain('Do not add text overlays, captions, watermarks');
  });
});
