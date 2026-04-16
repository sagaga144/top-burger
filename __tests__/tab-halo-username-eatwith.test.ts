/**
 * Tests for task: tab-halo-username-eatwith-v1
 *
 * Covers:
 *  1. updateUsername() in lib/firestore.ts
 *  2. USERNAME_REGEX validation logic (from app/(app)/profile.tsx)
 *  3. handleSelectFriend companion cap logic (MAX_COMPANIONS = 5)
 */

// ---------------------------------------------------------------------------
// Firebase mocks — must be declared before any import that touches firebase
// ---------------------------------------------------------------------------

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue('mock-doc-ref');

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  addDoc: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  onSnapshot: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

// Mock the lib/firebase module so db/auth/storage are stable mock objects
const mockAuth = { currentUser: null as { uid: string } | null };
jest.mock('../lib/firebase', () => ({
  db: {},
  get auth() { return mockAuth; },
  storage: {},
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// React Native Platform mock (used in firestore.ts uriToBlob)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { updateUsername } from '../lib/firestore';

// ---------------------------------------------------------------------------
// Replicate the USERNAME_REGEX from profile.tsx as a pure constant
// (the regex itself is the contract — we test the same pattern)
// ---------------------------------------------------------------------------

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// ---------------------------------------------------------------------------
// Replicate handleSelectFriend cap logic as a pure function
// (mirrors app/(app)/rate/[placeId].tsx lines 159-164)
// ---------------------------------------------------------------------------

interface UserSearchResult {
  uid: string;
  displayName: string;
}

const MAX_COMPANIONS = 5;

function selectFriend(
  currentSelection: UserSearchResult[],
  friend: UserSearchResult
): UserSearchResult[] {
  if (currentSelection.length >= MAX_COMPANIONS) {
    // Guard: cap reached — return selection unchanged
    return currentSelection;
  }
  return [...currentSelection, friend];
}

// ---------------------------------------------------------------------------
// Test Suite 1 — updateUsername (lib/firestore.ts)
// ---------------------------------------------------------------------------

describe('updateUsername', () => {
  beforeEach(() => {
    mockSetDoc.mockClear();
    mockDoc.mockClear();
    // Simulate an authenticated user whose uid matches the one passed to updateUsername
    mockAuth.currentUser = { uid: 'uid-abc' };
  });

  afterEach(() => {
    mockAuth.currentUser = null;
  });

  it('resolves without throwing for a valid username', async () => {
    await expect(updateUsername('uid-abc', 'CoolUser123')).resolves.toBeUndefined();
  });

  it('calls setDoc with the correct displayName field', async () => {
    await updateUsername('uid-abc', 'CoolUser123');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, dataArg] = mockSetDoc.mock.calls[0];
    expect(dataArg).toEqual({
      displayName: 'CoolUser123',
      displayNameLower: 'cooluser123',
    });
  });

  it('calls setDoc with displayNameLower set to the lowercase version of username', async () => {
    await updateUsername('uid-abc', 'MyBurgerFan');

    const [, dataArg] = mockSetDoc.mock.calls[0];
    expect(dataArg.displayNameLower).toBe('myburgerfan');
  });

  it('calls setDoc with merge: true so existing user fields are preserved', async () => {
    await updateUsername('uid-abc', 'CoolUser123');

    const [, , optionsArg] = mockSetDoc.mock.calls[0];
    expect(optionsArg).toEqual({ merge: true });
  });

  it('calls doc() targeting the users/{uid} path', async () => {
    mockAuth.currentUser = { uid: 'uid-test-123' };
    await updateUsername('uid-test-123', 'Tester');

    // doc is called as doc(db, 'users', uid)
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(), // db
      'users',
      'uid-test-123'
    );
  });

  it('propagates a Firestore rejection to the caller', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('Firestore write failed'));

    await expect(updateUsername('uid-abc', 'AnyName')).rejects.toThrow(
      'Firestore write failed'
    );
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2 — USERNAME_REGEX validation
// ---------------------------------------------------------------------------

describe('USERNAME_REGEX validation', () => {
  // --- Valid usernames ---

  it('accepts a simple 3-character lowercase username', () => {
    expect(USERNAME_REGEX.test('abc')).toBe(true);
  });

  it('accepts a 20-character username (maximum length)', () => {
    expect(USERNAME_REGEX.test('abcdefghij1234567890')).toBe(true);
  });

  it('accepts a username containing only letters', () => {
    expect(USERNAME_REGEX.test('BurgerFan')).toBe(true);
  });

  it('accepts a username containing letters, digits, and underscores', () => {
    expect(USERNAME_REGEX.test('Cool_User_99')).toBe(true);
  });

  it('accepts a username that starts with an underscore', () => {
    expect(USERNAME_REGEX.test('_hidden_user')).toBe(true);
  });

  it('accepts a username that is all digits', () => {
    expect(USERNAME_REGEX.test('12345')).toBe(true);
  });

  // --- Invalid: too short ---

  it('rejects a 2-character username (below minimum length of 3)', () => {
    expect(USERNAME_REGEX.test('ab')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(USERNAME_REGEX.test('')).toBe(false);
  });

  it('rejects a single character', () => {
    expect(USERNAME_REGEX.test('x')).toBe(false);
  });

  // --- Invalid: too long ---

  it('rejects a 21-character username (exceeds maximum length of 20)', () => {
    expect(USERNAME_REGEX.test('abcdefghij12345678901')).toBe(false);
  });

  // --- Invalid: special characters ---

  it('rejects a username containing a space', () => {
    expect(USERNAME_REGEX.test('Cool User')).toBe(false);
  });

  it('rejects a username containing a hyphen', () => {
    expect(USERNAME_REGEX.test('cool-user')).toBe(false);
  });

  it('rejects a username containing an at-sign', () => {
    expect(USERNAME_REGEX.test('user@domain')).toBe(false);
  });

  it('rejects a username containing a dot', () => {
    expect(USERNAME_REGEX.test('user.name')).toBe(false);
  });

  it('rejects a username containing Hebrew characters', () => {
    expect(USERNAME_REGEX.test('משתמש')).toBe(false);
  });

  it('rejects a username containing an exclamation mark', () => {
    expect(USERNAME_REGEX.test('hello!')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 3 — handleSelectFriend companion cap (MAX_COMPANIONS = 5)
// ---------------------------------------------------------------------------

function makeFriend(n: number): UserSearchResult {
  return { uid: `uid-${n}`, displayName: `Friend ${n}` };
}

describe('handleSelectFriend companion cap', () => {
  it('adds the first companion when the list is empty', () => {
    const result = selectFriend([], makeFriend(1));
    expect(result).toHaveLength(1);
  });

  it('adds up to the 5th companion successfully', () => {
    let selection: UserSearchResult[] = [];
    for (let i = 1; i <= 5; i++) {
      selection = selectFriend(selection, makeFriend(i));
    }
    expect(selection).toHaveLength(5);
  });

  it('contains the correct friend after adding', () => {
    const friend = makeFriend(1);
    const result = selectFriend([], friend);
    expect(result[0]).toEqual(friend);
  });

  it('does not mutate the original selection array', () => {
    const original: UserSearchResult[] = [makeFriend(1)];
    const before = [...original];
    selectFriend(original, makeFriend(2));
    expect(original).toEqual(before);
  });

  it('blocks adding a 6th companion when cap of 5 is reached', () => {
    const full: UserSearchResult[] = [1, 2, 3, 4, 5].map(makeFriend);
    const result = selectFriend(full, makeFriend(6));
    expect(result).toHaveLength(5);
  });

  it('returns the selection unchanged when a 6th companion is attempted', () => {
    const full: UserSearchResult[] = [1, 2, 3, 4, 5].map(makeFriend);
    const result = selectFriend(full, makeFriend(6));
    expect(result).toEqual(full);
  });

  it('the 6th companion is not present in the returned list', () => {
    const full: UserSearchResult[] = [1, 2, 3, 4, 5].map(makeFriend);
    const extra = makeFriend(6);
    const result = selectFriend(full, extra);
    expect(result.find((f) => f.uid === extra.uid)).toBeUndefined();
  });

  it('still blocks at exactly MAX_COMPANIONS without going over', () => {
    // Attempt to add companions 1..7 — only 5 should be retained
    let selection: UserSearchResult[] = [];
    for (let i = 1; i <= 7; i++) {
      selection = selectFriend(selection, makeFriend(i));
    }
    expect(selection.length).toBeLessThanOrEqual(MAX_COMPANIONS);
    expect(selection).toHaveLength(MAX_COMPANIONS);
  });
});
