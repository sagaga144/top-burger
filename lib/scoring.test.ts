import {
  MAX_COMPANIONS,
  computeAverage,
  addToAggregate,
  removeFromAggregate,
  addCompanion,
} from './scoring';
import { ReviewScores } from '../types';

const scores = (overrides: Partial<ReviewScores> = {}): ReviewScores => ({
  overTheTop: 8,
  priciness: 6,
  meatQuality: 9,
  service: 7,
  vibes: 8,
  theSides: 5,
  afterEffect: 7,
  ...overrides,
});

describe('computeAverage (7 categories)', () => {
  it('averages all seven scores, rounded to one decimal', () => {
    // 50 / 7 = 7.142857…
    expect(computeAverage(scores())).toBe(7.1);
  });

  it('rounds half up at the first decimal', () => {
    // 1+1+1+1+1+1+2 = 8 / 7 = 1.142… ; 10*6+9 = 69 / 7 = 9.857…
    expect(computeAverage(scores({ overTheTop: 1, priciness: 1, meatQuality: 1, service: 1, vibes: 1, theSides: 1, afterEffect: 2 }))).toBe(1.1);
    expect(computeAverage(scores({ overTheTop: 10, priciness: 10, meatQuality: 10, service: 10, vibes: 10, theSides: 10, afterEffect: 9 }))).toBe(9.9);
  });

  it('returns the score itself when all categories match', () => {
    const all = (n: number) => scores({ overTheTop: n, priciness: n, meatQuality: n, service: n, vibes: n, theSides: n, afterEffect: n });
    expect(computeAverage(all(1))).toBe(1);
    expect(computeAverage(all(10))).toBe(10);
  });

  it.each([0, 11, 7.5, NaN])('rejects a score of %p', (bad) => {
    expect(() => computeAverage(scores({ vibes: bad }))).toThrow('integer between 1 and 10');
  });
});

describe('restaurant / user aggregates', () => {
  it('starts a new aggregate from zero', () => {
    expect(addToAggregate(0, 0, 7.1)).toEqual({ count: 1, average: 7.1 });
  });

  it('folds a new score into the running average', () => {
    // (8 * 3 + 6) / 4 = 7.5
    expect(addToAggregate(3, 8, 6)).toEqual({ count: 4, average: 7.5 });
  });

  it('counts each copy of a tagged session', () => {
    // 1 existing review at 5, plus a 3-person session at 8: (5 + 24) / 4 = 7.25
    expect(addToAggregate(1, 5, 8, 3)).toEqual({ count: 4, average: 7.3 });
  });

  it('removing a score undoes adding it', () => {
    const added = addToAggregate(4, 7.5, 9);
    expect(removeFromAggregate(added.count, added.average, 9)).toEqual({ count: 4, average: 7.5 });
  });

  it('resets to zero when the last review is removed', () => {
    expect(removeFromAggregate(1, 7.1, 7.1)).toEqual({ count: 0, average: 0 });
  });

  it('keeps averages inside 1–10 despite rounding drift', () => {
    // Reviews of 10, 10 and 9.9 store a rounded average of 10.0; removing
    // the 9.9 would otherwise compute 10.05 → 10.1, which the rules reject.
    expect(removeFromAggregate(3, 10, 9.9)).toEqual({ count: 2, average: 10 });
    expect(removeFromAggregate(3, 1, 1.1)).toEqual({ count: 2, average: 1 });
  });

  it('never goes below zero', () => {
    expect(removeFromAggregate(0, 0, 7.1)).toEqual({ count: 0, average: 0 });
  });
});

describe('addCompanion (5-companion cap)', () => {
  const friend = (n: number) => ({ uid: `uid-${n}`, displayName: `Friend ${n}` });

  it('the cap is 5', () => {
    expect(MAX_COMPANIONS).toBe(5);
  });

  it('adds friends up to the cap, then ignores more', () => {
    let selection: ReturnType<typeof friend>[] = [];
    for (let i = 1; i <= 7; i++) selection = addCompanion(selection, friend(i));
    expect(selection.map((f) => f.uid)).toEqual(['uid-1', 'uid-2', 'uid-3', 'uid-4', 'uid-5']);
  });

  it('ignores a friend who is already selected', () => {
    const selection = addCompanion([friend(1)], friend(1));
    expect(selection).toHaveLength(1);
  });

  it('does not mutate the existing selection', () => {
    const original = [friend(1)];
    addCompanion(original, friend(2));
    expect(original).toHaveLength(1);
  });
});
