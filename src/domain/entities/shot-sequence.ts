/**
 * Storyboard length policy shared by the domain, API, and studio UI.
 *
 * Each shot maps 1:1 to one keyframe and one image-to-video clip, so the shot
 * count is the single source of truth for how much media a campaign produces.
 */

export const MIN_SHOT_COUNT = 1;
export const MAX_SHOT_COUNT = 5;
export const DEFAULT_SHOT_COUNT = 3;

export const SHOT_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;

export type ShotCount = (typeof SHOT_COUNT_OPTIONS)[number];

export type ShotRole =
  | 'hero-packshot'
  | 'lifestyle-context'
  | 'macro-finale';

export function isShotCount(value: number): value is ShotCount {
  return (
    Number.isInteger(value) &&
    value >= MIN_SHOT_COUNT &&
    value <= MAX_SHOT_COUNT
  );
}

/**
 * Keeps the familiar three-role language while allowing 1-5 beats:
 * - 1 shot: hero only.
 * - 2 shots: hero + macro finale.
 * - 3+ shots: hero, one or more lifestyle beats, macro finale.
 */
export function shotRoleForIndex(index: number, shotCount: number): ShotRole {
  if (shotCount <= 1) return 'hero-packshot';
  if (index <= 1) return 'hero-packshot';
  if (index >= shotCount) return 'macro-finale';
  return 'lifestyle-context';
}

export function shotTitleForIndex(index: number, shotCount: number): string {
  const role = shotRoleForIndex(index, shotCount);

  if (role === 'hero-packshot') return 'Hero Packshot';
  if (role === 'macro-finale') return 'Macro Finale';
  if (shotCount === 3) return 'Lifestyle Context';

  return `Lifestyle Beat ${index - 1}`;
}

export function describeShotSequence(shotCount: number): string {
  if (shotCount <= 1) return 'Hero packshot';
  if (shotCount === 2) return 'Hero packshot + macro finale';
  if (shotCount === 3) {
    return 'Hero packshot, lifestyle context, macro finale';
  }

  return `Hero packshot, ${shotCount - 2} lifestyle beats, macro finale`;
}
