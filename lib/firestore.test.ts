/**
 * Aggregate bookkeeping in saveReviewForMultipleUsers / deleteReview, run
 * against an in-memory fake of the Firestore transaction API.
 */

type Data = Record<string, any>;
const mockStore = new Map<string, Data>();
const mockWrites: { op: string; path: string; data?: Data }[] = [];
let mockAutoId = 0;

jest.mock('firebase/firestore', () => {
  const DELETE = { _delete: true };
  const snap = (path: string) => ({
    exists: () => mockStore.has(path),
    data: () => mockStore.get(path),
  });
  const merge = (path: string, data: Data) => {
    const next = { ...(mockStore.get(path) ?? {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v === DELETE) delete next[k];
      else next[k] = v;
    }
    mockStore.set(path, next);
  };
  return {
    collection: (_db: unknown, name: string) => ({ collection: name }),
    doc: (parent: any, name?: string, id?: string) =>
      parent?.collection
        ? { path: `${parent.collection}/auto-${++mockAutoId}` }
        : { path: `${name}/${id}` },
    serverTimestamp: () => 'SERVER_TIME',
    deleteField: () => DELETE,
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: async (ref: { path: string }) => snap(ref.path),
        set: (ref: { path: string }, data: Data, opts?: { merge?: boolean }) => {
          mockWrites.push({ op: 'set', path: ref.path, data });
          if (opts?.merge) merge(ref.path, data);
          else mockStore.set(ref.path, data);
        },
        update: (ref: { path: string }, data: Data) => {
          mockWrites.push({ op: 'update', path: ref.path, data });
          merge(ref.path, data);
        },
        delete: (ref: { path: string }) => {
          mockWrites.push({ op: 'delete', path: ref.path });
          mockStore.delete(ref.path);
        },
      };
      await fn(tx);
    },
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(),
  };
});

const mockAuth = { currentUser: null as { uid: string } | null };
jest.mock('./firebase', () => ({
  db: {},
  get auth() { return mockAuth; },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { saveReviewForMultipleUsers, deleteReview } from './firestore';
import { ReviewScores } from '../types';

const SCORES: ReviewScores = {
  overTheTop: 8, priciness: 6, meatQuality: 9, service: 7, vibes: 8, theSides: 5, afterEffect: 7,
}; // average 7.1

function rate(authorUid: string, taggedUids: string[] = [], placeName = 'Burger Bar') {
  mockAuth.currentUser = { uid: authorUid };
  return saveReviewForMultipleUsers({
    authorUid,
    taggedUids,
    placeId: 'place-1',
    placeName,
    placeAddress: 'Main St 1',
    scores: SCORES,
    photoUri: null,
  });
}

const reviewPathsFor = (uid: string) =>
  [...mockStore.entries()].filter(([p, d]) => p.startsWith('reviews/') && d.userId === uid).map(([p]) => p);

beforeEach(() => {
  mockStore.clear();
  mockWrites.length = 0;
  mockAutoId = 0;
  for (const [uid, name] of [['alice', 'Alice'], ['bob', 'Bob'], ['carol', 'Carol']]) {
    mockStore.set(`users/${uid}`, { displayName: name, totalReviews: 0, averageScoreGiven: 0 });
  }
});

describe('restaurant aggregate on review create', () => {
  it('creates the restaurant with the first review', async () => {
    await rate('alice');
    expect(mockStore.get('restaurants/place-1')).toEqual({
      placeId: 'place-1', name: 'Burger Bar', address: 'Main St 1', reviewCount: 1, averageScore: 7.1,
    });
  });

  it('folds later reviews into the average and only touches the aggregate fields', async () => {
    mockStore.set('restaurants/place-1', { placeId: 'place-1', name: 'Burger Bar', address: 'Main St 1', reviewCount: 3, averageScore: 9 });
    await rate('alice', [], 'בורגר בר');
    const update = mockWrites.find((w) => w.path === 'restaurants/place-1');
    // (9 * 3 + 7.1) / 4 = 8.525
    expect(update).toEqual({ op: 'update', path: 'restaurants/place-1', data: { reviewCount: 4, averageScore: 8.5 } });
    expect(mockStore.get('restaurants/place-1')?.name).toBe('Burger Bar');
  });

  it('counts one review per participant when friends are tagged', async () => {
    await rate('alice', ['bob', 'carol']);
    expect(mockStore.get('restaurants/place-1')).toMatchObject({ reviewCount: 3, averageScore: 7.1 });
  });

  it("updates the author's and every tagged friend's stats", async () => {
    await rate('alice', ['bob']);
    expect(mockStore.get('users/alice')).toMatchObject({ totalReviews: 1, averageScoreGiven: 7.1, displayNameLower: 'alice' });
    expect(mockStore.get('users/bob')).toMatchObject({ totalReviews: 1, averageScoreGiven: 7.1 });
  });

  it('stores display names, not emails, on each review copy', async () => {
    mockStore.set('users/alice', { displayName: 'Alice', email: 'alice@example.com', totalReviews: 0, averageScoreGiven: 0 });
    await rate('alice', ['bob']);
    const reviews = [...mockStore.entries()].filter(([p]) => p.startsWith('reviews/')).map(([, d]) => d);
    expect(reviews.map((r) => r.userName).sort()).toEqual(['Alice', 'Bob']);
    expect(reviews.every((r) => !('userEmail' in r))).toBe(true);
    expect(mockStore.get('users/alice')).not.toHaveProperty('email');
  });

  it('rejects more than 5 tagged companions before writing anything', async () => {
    await expect(rate('alice', ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'])).rejects.toThrow('Too many tagged companions');
    expect(mockWrites).toHaveLength(0);
  });

  it('ignores duplicate or self tags when applying the cap', async () => {
    await rate('alice', ['bob', 'bob', 'alice']);
    expect(reviewPathsFor('bob')).toHaveLength(1);
    expect(mockStore.get('restaurants/place-1')?.reviewCount).toBe(2);
  });
});

describe('restaurant aggregate on review delete', () => {
  it('removes the score from the average', async () => {
    mockStore.set('restaurants/place-1', { placeId: 'place-1', name: 'B', address: '', reviewCount: 1, averageScore: 8.9 });
    await rate('alice');
    expect(mockStore.get('restaurants/place-1')).toMatchObject({ reviewCount: 2, averageScore: 8 });

    await deleteReview(reviewPathsFor('alice')[0].split('/')[1]);
    expect(mockStore.get('restaurants/place-1')).toMatchObject({ reviewCount: 1, averageScore: 8.9 });
  });

  it('deletes the restaurant with its last review and resets the user', async () => {
    await rate('alice');
    await deleteReview(reviewPathsFor('alice')[0].split('/')[1]);
    expect(mockStore.has('restaurants/place-1')).toBe(false);
    expect(mockStore.get('users/alice')).toMatchObject({ totalReviews: 0, averageScoreGiven: 0 });
  });

  it("rolls back a tagged friend's stats when the author deletes their copy", async () => {
    await rate('alice', ['bob']);
    await deleteReview(reviewPathsFor('bob')[0].split('/')[1]);
    expect(mockStore.get('users/bob')).toMatchObject({ totalReviews: 0 });
    expect(mockStore.get('restaurants/place-1')?.reviewCount).toBe(1);
  });

  it("refuses to delete someone else's review", async () => {
    await rate('alice');
    mockAuth.currentUser = { uid: 'carol' };
    await expect(deleteReview(reviewPathsFor('alice')[0].split('/')[1])).rejects.toThrow('Not authorized');
    expect(mockStore.has('restaurants/place-1')).toBe(true);
  });
});
