import { ReviewScores } from '../types';

/** Maximum number of friends that can be tagged on one review. */
export const MAX_COMPANIONS = 5;

/** Rounds to one decimal place, the precision every stored average uses. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Averages the 7 category scores. Each score must be an integer from 1 to 10. */
export function computeAverage(scores: ReviewScores): number {
  const values = Object.values(scores) as number[];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 10)) {
    throw new Error('Each score must be an integer between 1 and 10.');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return round1(sum / values.length);
}

export interface Aggregate {
  count: number;
  average: number;
}

// Stored averages are rounded, so undoing a score can drift slightly past the
// 1–10 range (e.g. removing 9.9 from a stored 10.0 average of 3 gives 10.05).
function clampScore(n: number): number {
  return Math.min(10, Math.max(1, round1(n)));
}

/** Folds `added` copies of `score` into a running count/average. */
export function addToAggregate(oldCount: number, oldAvg: number, score: number, added = 1): Aggregate {
  const count = oldCount + added;
  return { count, average: clampScore((oldAvg * oldCount + score * added) / count) };
}

/** Removes one `score` from a running count/average. Never goes below zero. */
export function removeFromAggregate(oldCount: number, oldAvg: number, score: number): Aggregate {
  const count = Math.max(0, oldCount - 1);
  if (count === 0) return { count: 0, average: 0 };
  return { count, average: clampScore((oldAvg * oldCount - score) / count) };
}

/** Adds a companion unless the cap is reached or they're already selected. */
export function addCompanion<T extends { uid: string }>(selection: T[], friend: T): T[] {
  if (selection.length >= MAX_COMPANIONS) return selection;
  if (selection.some((f) => f.uid === friend.uid)) return selection;
  return [...selection, friend];
}
