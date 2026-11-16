import { describe, expect, it } from 'vitest';
import { toDownloadFileName, toVideoDownloadHref } from '../studio-utils';

describe('toDownloadFileName', () => {
  it('builds a readable slug for the active shot', () => {
    expect(toDownloadFileName('Oud Al-Sahara Élixir', 2)).toBe(
      'driftzero-oud-al-sahara-elixir-shot-2.mp4',
    );
  });

  it('falls back to a generic clip name when the product name is empty', () => {
    expect(toDownloadFileName('   ', 1)).toBe('driftzero-clip-shot-1.mp4');
  });
});

describe('toVideoDownloadHref', () => {
  it('asks the server proxy for an attachment', () => {
    expect(toVideoDownloadHref('/api/videos/abc/content')).toBe(
      '/api/videos/abc/content?download=1',
    );
    expect(toVideoDownloadHref('/api/videos/abc/content?foo=bar')).toBe(
      '/api/videos/abc/content?foo=bar&download=1',
    );
  });

  it('leaves local fixture URLs untouched', () => {
    expect(toVideoDownloadHref('/fixtures/shot-2.mp4')).toBe(
      '/fixtures/shot-2.mp4',
    );
  });
});
