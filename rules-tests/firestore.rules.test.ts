/**
 * Firestore security rules tests, run against the local emulator:
 *
 *   npm run test:rules
 *
 * The allowed flows call the app's real write functions in lib/firestore.ts,
 * pointed at the emulator, so a rule change that breaks the app fails here.
 * The abuse cases write directly with the SDK, as a malicious client would.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';

// lib/firestore.ts reads `db` and `auth.currentUser` from lib/firebase; point
// both at whichever emulator user the test is acting as.
const mockCurrent: { db: Firestore | null; uid: string | null } = { db: null, uid: null };
jest.mock('../lib/firebase', () => ({
  get db() { return mockCurrent.db; },
  auth: { get currentUser() { return mockCurrent.uid ? { uid: mockCurrent.uid } : null; } },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import {
  saveReviewForMultipleUsers,
  deleteReview,
  updateUsername,
  searchUsersByDisplayName,
} from '../lib/firestore';
import type { ReviewScores } from '../types';

let env: RulesTestEnvironment;

const SCORES: ReviewScores = {
  overTheTop: 8, priciness: 6, meatQuality: 9, service: 7, vibes: 8, theSides: 5, afterEffect: 7,
}; // average 7.1

function dbAs(uid: string | null): Firestore {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}

function actAs(uid: string) {
  mockCurrent.uid = uid;
  mockCurrent.db = dbAs(uid);
}

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
  });
}

async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}

async function seedUser(uid: string, displayName: string, extra: Record<string, unknown> = {}) {
  await seed(`users/${uid}`, {
    displayName,
    displayNameLower: displayName.toLowerCase(),
    totalReviews: 0,
    averageScoreGiven: 0,
    ...extra,
  });
}

/** Saves a review through the app and returns the created review docs. */
async function rate(author: string, tagged: string[] = [], placeId = 'photon-N-1', placeName = 'Burger Bar') {
  actAs(author);
  await saveReviewForMultipleUsers({
    authorUid: author,
    taggedUids: tagged,
    placeId,
    placeName,
    placeAddress: 'Main St 1, Tel Aviv, Israel',
    scores: SCORES,
    photoUri: null,
  });
  let reviews: { id: string; data: Record<string, unknown> }[] = [];
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await (ctx.firestore() as any).collection('reviews').where('authorId', '==', author).get();
    reviews = snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
  });
  return reviews;
}

/** A valid review document as the app writes it, for direct-write cases. */
function reviewDoc(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: 'photon-N-1',
    restaurantName: 'Burger Bar',
    restaurantAddress: 'Main St 1',
    userId: 'alice',
    authorId: 'alice',
    userName: 'Alice',
    scores: SCORES,
    averageScore: 7.1,
    photoUrl: null,
    eatenWith: ['alice'],
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-top-burger',
    firestore: { rules: readFileSync(process.env.RULES_FILE ?? resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  mockCurrent.uid = null;
  mockCurrent.db = null;
  await seedUser('alice', 'Alice');
  await seedUser('bob', 'Bob');
  await seedUser('carol', 'Carol');
});

// ---------------------------------------------------------------------------
// Allowed flows the app uses
// ---------------------------------------------------------------------------

describe('allowed app flows', () => {
  it('sign-up creates your own user doc (login.tsx)', async () => {
    const db = dbAs('dave');
    await assertSucceeds(setDoc(doc(db, 'users/dave'), {
      displayName: 'Dave',
      displayNameLower: 'dave',
      totalReviews: 0,
      averageScoreGiven: 0,
      createdAt: serverTimestamp(),
    }));
  });

  it('updateUsername changes your own display name', async () => {
    actAs('alice');
    await assertSucceeds(updateUsername('alice', 'AliceB'));
    expect((await read('users/alice'))?.displayNameLower).toBe('aliceb');
  });

  it('updateUsername still works on a legacy doc that holds an email', async () => {
    await seedUser('alice', 'Alice', { email: 'alice@example.com' });
    actAs('alice');
    await assertSucceeds(updateUsername('alice', 'AliceB'));
  });

  it('a solo review creates the restaurant and updates your stats', async () => {
    const reviews = await rate('alice');
    expect(reviews).toHaveLength(1);
    expect(reviews[0].data).toMatchObject({ userId: 'alice', authorId: 'alice', userName: 'Alice' });
    expect(reviews[0].data).not.toHaveProperty('userEmail');
    expect(await read('restaurants/photon-N-1')).toMatchObject({ reviewCount: 1, averageScore: 7.1 });
    expect(await read('users/alice')).toMatchObject({ totalReviews: 1, averageScoreGiven: 7.1 });
  });

  it('a review tagging 2 friends writes 3 copies and updates everyone in one transaction', async () => {
    await rate('carol', [], 'photon-N-1', 'Burger Bar');
    const reviews = await rate('alice', ['bob', 'carol'], 'photon-N-1', 'בורגר בר');

    expect(reviews.map((r) => r.data.userId).sort()).toEqual(['alice', 'bob', 'carol']);
    expect(reviews.find((r) => r.data.userId === 'bob')?.data.userName).toBe('Bob');
    const restaurant = await read('restaurants/photon-N-1');
    expect(restaurant).toMatchObject({ reviewCount: 4, name: 'Burger Bar' }); // name not overwritten
    expect((await read('users/bob'))?.totalReviews).toBe(1);
    expect((await read('users/carol'))?.totalReviews).toBe(2);
  });

  it('tagging 5 friends (the cap) is allowed', async () => {
    for (const uid of ['f1', 'f2', 'f3', 'f4', 'f5']) await seedUser(uid, uid);
    const reviews = await rate('alice', ['f1', 'f2', 'f3', 'f4', 'f5']);
    expect(reviews).toHaveLength(6);
  });

  it('saving clears a legacy email from your own user doc', async () => {
    await seedUser('alice', 'Alice', { email: 'alice@example.com' });
    await rate('alice');
    expect(await read('users/alice')).not.toHaveProperty('email');
  });

  it('deleting your last review removes the restaurant and resets your stats', async () => {
    const [review] = await rate('alice');
    actAs('alice');
    await assertSucceeds(deleteReview(review.id));
    expect(await read('restaurants/photon-N-1')).toBeUndefined();
    expect(await read('users/alice')).toMatchObject({ totalReviews: 0, averageScoreGiven: 0 });
  });

  it("the author can delete a friend's copy, rolling back the friend's stats", async () => {
    const reviews = await rate('alice', ['bob']);
    const bobsCopy = reviews.find((r) => r.data.userId === 'bob')!;
    actAs('alice');
    await assertSucceeds(deleteReview(bobsCopy.id));
    expect((await read('users/bob'))?.totalReviews).toBe(0);
    expect((await read('restaurants/photon-N-1'))?.reviewCount).toBe(1);
  });

  it('a tagged friend can delete their own copy', async () => {
    const reviews = await rate('alice', ['bob']);
    const bobsCopy = reviews.find((r) => r.data.userId === 'bob')!;
    actAs('bob');
    await assertSucceeds(deleteReview(bobsCopy.id));
  });

  it('a legacy review without authorId can be deleted by its owner', async () => {
    await seed('restaurants/photon-N-1', { placeId: 'photon-N-1', name: 'B', address: '', reviewCount: 2, averageScore: 7 });
    await seed('reviews/legacy', {
      restaurantId: 'photon-N-1', restaurantName: 'B', restaurantAddress: '', userId: 'alice',
      userEmail: 'alice@example.com', scores: SCORES, averageScore: 7.1, photoUrl: null, createdAt: new Date(),
    });
    actAs('alice');
    await assertSucceeds(deleteReview('legacy'));
  });

  it('a user with a long display name can still review and be tagged', async () => {
    const long = 'A'.repeat(80);
    await seedUser('bob', long);
    const reviews = await rate('alice', ['bob']);
    expect(reviews.find((r) => r.data.userId === 'bob')?.data.userName).toBe(long);
  });

  it('deleting still works when rounding drift would push an average past 10', async () => {
    await seed('restaurants/photon-N-1', { placeId: 'photon-N-1', name: 'B', address: '', reviewCount: 3, averageScore: 10 });
    await seedUser('alice', 'Alice', { totalReviews: 3, averageScoreGiven: 10 });
    await seed('reviews/drift', { ...reviewDoc({ createdAt: new Date() }), averageScore: 9.9 });
    actAs('alice');
    await assertSucceeds(deleteReview('drift'));
    expect(await read('restaurants/photon-N-1')).toMatchObject({ reviewCount: 2, averageScore: 10 });
  });

  it('friend search works for a signed-in user', async () => {
    actAs('alice');
    const results = await searchUsersByDisplayName('bo', 'alice');
    expect(results).toEqual([{ uid: 'bob', displayName: 'Bob' }]);
  });

  it('restaurants and reviews are publicly readable', async () => {
    await rate('alice');
    const anon = dbAs(null);
    await assertSucceeds(getDoc(doc(anon, 'restaurants/photon-N-1')));
    const [review] = await rate('alice', [], 'photon-N-2');
    await assertSucceeds(getDoc(doc(anon, 'reviews/' + review.id)));
  });
});

// ---------------------------------------------------------------------------
// Abuse cases that must be denied
// ---------------------------------------------------------------------------

describe('users: denied', () => {
  it('control: a friend may move your review count by exactly one', async () => {
    await assertSucceeds(updateDoc(doc(dbAs('bob'), 'users/alice'), { totalReviews: 1, averageScoreGiven: 7.1 }));
  });

  it("can't overwrite another user's doc", async () => {
    const db = dbAs('bob');
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'Hacked', totalReviews: 0, averageScoreGiven: 0 }));
  });

  it("can't change another user's name", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'users/alice'), { displayName: 'Hacked', displayNameLower: 'hacked' }));
  });

  it("can't set another user's email", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'users/alice'), { email: 'x@evil.com' }));
  });

  it("can't jump another user's review count by more than one", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'users/alice'), { totalReviews: 50 }));
  });

  it("can't create a user doc for someone else", async () => {
    await assertFails(setDoc(doc(dbAs('bob'), 'users/zed'), { displayName: 'Zed', totalReviews: 0, averageScoreGiven: 0 }));
  });

  it("can't store an email on your own doc", async () => {
    await assertFails(setDoc(doc(dbAs('dave'), 'users/dave'), { displayName: 'Dave', email: 'dave@example.com' }));
    await assertFails(updateDoc(doc(dbAs('alice'), 'users/alice'), { email: 'alice@example.com' }));
  });

  it("can't make your search name differ from your display name", async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'users/alice'), { displayNameLower: 'bob' }));
  });

  it("can't add arbitrary fields to your own doc", async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'users/alice'), { contactEmail: 'alice@example.com' }));
  });

  it("can't read user docs (or their emails) while signed out", async () => {
    await assertFails(getDoc(doc(dbAs(null), 'users/alice')));
  });
});

describe('reviews: denied', () => {
  beforeEach(async () => {
    await seed('restaurants/photon-N-1', { placeId: 'photon-N-1', name: 'Burger Bar', address: '', reviewCount: 1, averageScore: 7.1 });
    await seed('reviews/r1', { ...reviewDoc(), createdAt: new Date() });
  });

  it('control: the base review payload is valid for its author, with or without a Cloudinary photo', async () => {
    await assertSucceeds(setDoc(doc(dbAs('alice'), 'reviews/ok1'), reviewDoc()));
    await assertSucceeds(setDoc(doc(dbAs('alice'), 'reviews/ok2'), reviewDoc({
      userId: 'bob', userName: 'Bob', eatenWith: ['alice', 'bob'],
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg', photoAspectRatio: 0.75,
    })));
  });

  it("can't update another user's review scores", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'reviews/r1'), { scores: { ...SCORES, overTheTop: 1 } }));
  });

  it("can't reassign a review to someone else, even as its author", async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'reviews/r1'), { userId: 'bob' }));
  });

  it("can't delete a review you neither wrote nor were tagged on", async () => {
    await assertFails(deleteDoc(doc(dbAs('bob'), 'reviews/r1')));
  });

  it("can't put a fake name on a friend's copy", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ userId: 'bob', userName: 'Carol', eatenWith: ['alice', 'bob'] })));
  });

  it('control: the author may edit their own review scores', async () => {
    await assertSucceeds(updateDoc(doc(dbAs('alice'), 'reviews/r1'), { scores: { ...SCORES, vibes: 10 }, averageScore: 7.4 }));
  });

  it("can't add fields when editing your own review", async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'reviews/r1'), { featured: true }));
  });

  it("can't create a review in someone else's name", async () => {
    await assertFails(setDoc(doc(dbAs('bob'), 'reviews/x'), reviewDoc({ authorId: 'alice', userId: 'alice' })));
  });

  it("can't write a review for someone who isn't in eatenWith", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ userId: 'bob', eatenWith: ['alice'] })));
  });

  it("can't tag more than 5 friends", async () => {
    const eatenWith = ['alice', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ userId: 'f1', eatenWith })));
  });

  it("can't store an email on a review", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ userEmail: 'alice@example.com' })));
  });

  it("can't submit an out-of-range score", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ scores: { ...SCORES, vibes: 11 } })));
  });

  it("can't review a restaurant that doesn't exist", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ restaurantId: 'nope' })));
  });

  it("can't attach a photo hosted outside Cloudinary", async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'reviews/x'), reviewDoc({ photoUrl: 'https://evil.example/x.jpg' })));
  });

  it("can't write while signed out", async () => {
    await assertFails(setDoc(doc(dbAs(null), 'reviews/x'), reviewDoc()));
  });
});

describe('restaurants: denied', () => {
  beforeEach(async () => {
    await seed('restaurants/r', { placeId: 'r', name: 'Burger Bar', address: '', reviewCount: 5, averageScore: 7 });
  });

  it('control: aggregate-only updates within bounds are allowed', async () => {
    await assertSucceeds(updateDoc(doc(dbAs('bob'), 'restaurants/r'), { reviewCount: 8, averageScore: 7.4 }));
    await assertSucceeds(updateDoc(doc(dbAs('bob'), 'restaurants/r'), { reviewCount: 7, averageScore: 7.2 }));
    await assertSucceeds(setDoc(doc(dbAs('bob'), 'restaurants/n'), { placeId: 'n', name: 'New', address: '', reviewCount: 1, averageScore: 7 }));
  });

  it("can't rename a restaurant", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'restaurants/r'), { name: 'Hacked' }));
  });

  it("can't inflate the review count", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'restaurants/r'), { reviewCount: 500 }));
  });

  it("can't set an impossible average", async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'restaurants/r'), { reviewCount: 6, averageScore: 50 }));
  });

  it("can't delete a restaurant that still has reviews", async () => {
    await assertFails(deleteDoc(doc(dbAs('bob'), 'restaurants/r')));
  });

  it("can't create a restaurant with extra fields or a mismatched id", async () => {
    const base = { placeId: 'n', name: 'New', address: '', reviewCount: 1, averageScore: 7 };
    await assertFails(setDoc(doc(dbAs('bob'), 'restaurants/n'), { ...base, featured: true }));
    await assertFails(setDoc(doc(dbAs('bob'), 'restaurants/n'), { ...base, placeId: 'other' }));
  });

  it("can't write while signed out", async () => {
    await assertFails(updateDoc(doc(dbAs(null), 'restaurants/r'), { reviewCount: 6 }));
  });
});
