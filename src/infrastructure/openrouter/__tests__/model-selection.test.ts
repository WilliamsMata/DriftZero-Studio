import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BRIEF_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_TEXT_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  DEFAULT_VISION_QA_MODEL_ID,
  getDefaultBriefModelId,
  getDefaultImageModelId,
  getDefaultTextModelId,
  getDefaultVideoModelId,
  getDefaultVisionQaModelId,
} from '../model-catalog';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('model selection', () => {
  it('uses the built-in defaults when no override is configured', () => {
    vi.stubEnv('OPENROUTER_TEXT_MODEL', '');
    vi.stubEnv('OPENROUTER_VISION_QA_MODEL', '');
    vi.stubEnv('OPENROUTER_BRIEF_MODEL', '');
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', '');
    vi.stubEnv('OPENROUTER_VIDEO_MODEL', '');

    expect(getDefaultTextModelId()).toBe(DEFAULT_TEXT_MODEL_ID);
    expect(getDefaultVisionQaModelId()).toBe(DEFAULT_VISION_QA_MODEL_ID);
    expect(getDefaultBriefModelId()).toBe(DEFAULT_BRIEF_MODEL_ID);
    expect(getDefaultImageModelId()).toBe(DEFAULT_IMAGE_MODEL_ID);
    expect(getDefaultVideoModelId()).toBe(DEFAULT_VIDEO_MODEL_ID);
  });

  it('reads text and vision overrides independently', () => {
    vi.stubEnv('OPENROUTER_TEXT_MODEL', 'google/gemini-3.8-flash');
    vi.stubEnv('OPENROUTER_VISION_QA_MODEL', 'anthropic/claude-haiku-5.5');
    vi.stubEnv('OPENROUTER_BRIEF_MODEL', 'meta/muse-ember');

    expect(getDefaultTextModelId()).toBe('google/gemini-3.8-flash');
    expect(getDefaultVisionQaModelId()).toBe('anthropic/claude-haiku-5.5');
    expect(getDefaultBriefModelId()).toBe('meta/muse-ember');
  });

  it('accepts a text-only model for brief drafting', () => {
    vi.stubEnv('OPENROUTER_BRIEF_MODEL', 'z-ai/glm-5.3-flash');

    expect(getDefaultBriefModelId()).toBe('z-ai/glm-5.3-flash');
  });

  it('accepts image and video overrides declared in the snapshot', () => {
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'bytedance-seed/seedream-5-5');
    vi.stubEnv('OPENROUTER_VIDEO_MODEL', 'google/veo-3.1-lite');

    expect(getDefaultImageModelId()).toBe('bytedance-seed/seedream-5-5');
    expect(getDefaultVideoModelId()).toBe('google/veo-3.1-lite');
  });

  it('does not accept a text-only model for Vision QA', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('OPENROUTER_VISION_QA_MODEL', 'z-ai/glm-5.3-flash');

    expect(getDefaultVisionQaModelId()).toBe(DEFAULT_VISION_QA_MODEL_ID);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back and warns for unknown image or video ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'unknown/image-model');
    vi.stubEnv('OPENROUTER_VIDEO_MODEL', 'unknown/video-model');
    vi.stubEnv('OPENROUTER_BRIEF_MODEL', 'unknown/brief-model');

    expect(getDefaultImageModelId()).toBe(DEFAULT_IMAGE_MODEL_ID);
    expect(getDefaultVideoModelId()).toBe(DEFAULT_VIDEO_MODEL_ID);
    expect(getDefaultBriefModelId()).toBe(DEFAULT_BRIEF_MODEL_ID);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
