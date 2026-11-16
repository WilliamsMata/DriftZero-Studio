import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHOT_COUNT,
  describeShotSequence,
  isShotCount,
  shotRoleForIndex,
  shotTitleForIndex,
} from '../shot-sequence';

describe('shot sequence policy', () => {
  it('defaults to three shots', () => {
    expect(DEFAULT_SHOT_COUNT).toBe(3);
  });

  it('keeps a hero-only one-shot campaign', () => {
    expect(shotRoleForIndex(1, 1)).toBe('hero-packshot');
    expect(shotTitleForIndex(1, 1)).toBe('Hero Packshot');
    expect(describeShotSequence(1)).toBe('Hero packshot');
  });

  it('uses hero plus macro finale for two shots', () => {
    expect([1, 2].map((index) => shotRoleForIndex(index, 2))).toEqual([
      'hero-packshot',
      'macro-finale',
    ]);
  });

  it('keeps the classic three-shot sequence', () => {
    expect([1, 2, 3].map((index) => shotRoleForIndex(index, 3))).toEqual([
      'hero-packshot',
      'lifestyle-context',
      'macro-finale',
    ]);
    expect(shotTitleForIndex(2, 3)).toBe('Lifestyle Context');
  });

  it('expands middle lifestyle beats up to five shots', () => {
    expect([1, 2, 3, 4, 5].map((index) => shotRoleForIndex(index, 5))).toEqual([
      'hero-packshot',
      'lifestyle-context',
      'lifestyle-context',
      'lifestyle-context',
      'macro-finale',
    ]);
    expect(shotTitleForIndex(3, 5)).toBe('Lifestyle Beat 2');
    expect(describeShotSequence(5)).toBe(
      'Hero packshot, 3 lifestyle beats, macro finale',
    );
  });

  it('rejects counts outside the supported range', () => {
    expect(isShotCount(1)).toBe(true);
    expect(isShotCount(5)).toBe(true);
    expect(isShotCount(0)).toBe(false);
    expect(isShotCount(6)).toBe(false);
    expect(isShotCount(2.5)).toBe(false);
  });
});
