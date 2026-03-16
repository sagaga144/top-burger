import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { Platform } from 'react-native';
import { db, storage } from './firebase';
import {
  Review,
  ReviewScores,
  RestaurantWithId,
  ReviewWithId,
  AppUser,
} from '../types';

// ---- Helpers ----

async function uriToBlob(uri: string): Promise<Blob> {
  // On web, blob:/https: URIs work cleanly with fetch() without CORS issues.
  // On native, use XHR which handles local file:// and content:// URIs correctly.
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.blob();
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

function computeAverage(scores: ReviewScores): number {
  const values = Object.values(scores) as number[];
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

// ---- Restaurants ----

export async function getRestaurants(): Promise<RestaurantWithId[]> {
  const q = query(
    collection(db, 'restaurants'),
    orderBy('averageScore', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<RestaurantWithId, 'id'>),
  }));
}

// ---- Real-time Subscriptions ----

export function subscribeToRestaurants(
  onData: (restaurants: RestaurantWithId[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, 'restaurants'), orderBy('averageScore', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RestaurantWithId, 'id'>) })));
  }, onError);
}

export function subscribeToRestaurantReviews(
  restaurantId: string,
  onData: (reviews: ReviewWithId[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'reviews'),
    where('restaurantId', '==', restaurantId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Review) })));
  }, onError);
}

export function subscribeToUserReviews(
  userId: string,
  onData: (reviews: ReviewWithId[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Review) })));
  }, onError);
}

// ---- Reviews ----

export async function getReview(reviewId: string): Promise<ReviewWithId | null> {
  const snap = await getDoc(doc(db, 'reviews', reviewId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Review) };
}

export async function getUserReviews(userId: string): Promise<ReviewWithId[]> {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Review),
  }));
}

// ---- Save Review (atomic transaction) ----

export interface SaveReviewParams {
  placeId: string;
  restaurantName: string;
  restaurantAddress: string;
  userId: string;
  userEmail: string;
  scores: ReviewScores;
  photoUri: string | null;
}

export async function saveReview(params: SaveReviewParams): Promise<string> {
  const {
    placeId,
    restaurantName,
    restaurantAddress,
    userId,
    userEmail,
    scores,
    photoUri,
  } = params;

  const averageScore = computeAverage(scores);

  // Upload photo first (outside transaction — Storage is not transactional)
  let photoUrl: string | null = null;
  if (photoUri) {
    const blob = await uriToBlob(photoUri);
    const photoRef = ref(
      storage,
      `reviews/${userId}/${Date.now()}.jpg`
    );
    await uploadBytes(photoRef, blob);
    photoUrl = await getDownloadURL(photoRef);
  }

  const restaurantRef = doc(db, 'restaurants', placeId);
  const userRef = doc(db, 'users', userId);
  const reviewRef = doc(collection(db, 'reviews'));

  await runTransaction(db, async (transaction) => {
    // Read restaurant document
    const restaurantSnap = await transaction.get(restaurantRef);
    const userData = await transaction.get(userRef);

    // Compute updated restaurant aggregate
    let newReviewCount = 1;
    let newAverageScore = averageScore;

    if (restaurantSnap.exists()) {
      const existing = restaurantSnap.data();
      const oldCount: number = existing.reviewCount ?? 0;
      const oldAvg: number = existing.averageScore ?? 0;
      newReviewCount = oldCount + 1;
      newAverageScore =
        Math.round(((oldAvg * oldCount + averageScore) / newReviewCount) * 10) /
        10;
    }

    // Compute updated user aggregate
    let newTotalReviews = 1;
    let newAvgScoreGiven = averageScore;

    if (userData.exists()) {
      const ud = userData.data();
      const oldTotal: number = ud.totalReviews ?? 0;
      const oldAvgGiven: number = ud.averageScoreGiven ?? 0;
      newTotalReviews = oldTotal + 1;
      newAvgScoreGiven =
        Math.round(
          ((oldAvgGiven * oldTotal + averageScore) / newTotalReviews) * 10
        ) / 10;
    }

    // Write restaurant (upsert)
    transaction.set(restaurantRef, {
      placeId,
      name: restaurantName,
      address: restaurantAddress,
      reviewCount: newReviewCount,
      averageScore: newAverageScore,
    });

    // Write review
    transaction.set(reviewRef, {
      restaurantId: placeId,
      restaurantName,
      restaurantAddress,
      userId,
      userEmail,
      scores,
      averageScore,
      photoUrl,
      createdAt: serverTimestamp(),
    });

    // Write/update user document
    transaction.set(
      userRef,
      {
        email: userEmail,
        displayNameLower: (userEmail || '').toLowerCase(),
        totalReviews: newTotalReviews,
        averageScoreGiven: newAvgScoreGiven,
        ...(userData.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  });

  return reviewRef.id;
}

// ---- User ----

export async function getUserProfile(userId: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return snap.data() as AppUser;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', reviewId));
}

// ---- User Search ----

export interface UserSearchResult {
  uid: string;
  displayName: string;
  email: string;
}

export async function searchUsersByDisplayName(
  text: string,
  excludeUid: string
): Promise<UserSearchResult[]> {
  if (!text.trim()) return [];
  const lower = text.toLowerCase().trim();
  const end = lower + '\uf8ff';

  // Parallel: search by displayNameLower AND email prefix
  const [nameSnap, emailSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('displayNameLower', '>=', lower),
      where('displayNameLower', '<=', end),
      limit(6)
    )),
    getDocs(query(
      collection(db, 'users'),
      where('email', '>=', lower),
      where('email', '<=', end),
      limit(6)
    )),
  ]);

  const seen = new Set<string>();
  const results: UserSearchResult[] = [];
  [...nameSnap.docs, ...emailSnap.docs].forEach(d => {
    if (d.id === excludeUid || seen.has(d.id)) return;
    seen.add(d.id);
    const data = d.data();
    results.push({
      uid: d.id,
      displayName: data.displayName || data.email?.split('@')[0] || 'User',
      email: data.email ?? '',
    });
  });
  return results.slice(0, 5);
}

// ---- Save Review for Multiple Users ----

export interface SaveReviewForMultipleUsersParams {
  authorUid: string;
  authorEmail: string;
  taggedUids: string[];
  taggedUsers?: UserSearchResult[];
  placeId: string;
  placeName: string;
  placeAddress: string;
  scores: ReviewScores;
  photoUri: string | null;
}

export async function saveReviewForMultipleUsers(
  params: SaveReviewForMultipleUsersParams
): Promise<void> {
  const {
    authorUid,
    authorEmail,
    taggedUids,
    taggedUsers = [],
    placeId,
    placeName,
    placeAddress,
    scores,
    photoUri,
  } = params;

  const averageScore = computeAverage(scores);
  const allParticipantUids = [authorUid, ...taggedUids];

  // Upload photo once outside of the batch (Storage is not transactional)
  let photoUrl: string | null = null;
  if (photoUri) {
    const blob = await uriToBlob(photoUri);
    const photoRef = ref(storage, `reviews/${authorUid}/${Date.now()}.jpg`);
    await uploadBytes(photoRef, blob);
    photoUrl = await getDownloadURL(photoRef);
  }

  const taggedUserMap = new Map(taggedUsers.map((u) => [u.uid, u]));
  const batch = writeBatch(db);

  // Write one review document per participant
  for (const participantUid of allParticipantUids) {
    const reviewRef = doc(collection(db, 'reviews'));
    batch.set(reviewRef, {
      restaurantId: placeId,
      restaurantName: placeName,
      restaurantAddress: placeAddress,
      userId: participantUid,
      authorId: authorUid,
      userEmail: participantUid === authorUid ? authorEmail : (taggedUserMap.get(participantUid)?.email ?? ''),
      scores,
      averageScore,
      photoUrl,
      eatenWith: allParticipantUids,
      createdAt: serverTimestamp(),
    });
  }

  // Read docs needed for aggregates before batch
  const restaurantRef = doc(db, 'restaurants', placeId);
  const authorUserRef = doc(db, 'users', authorUid);
  const [restaurantSnap, authorSnap] = await Promise.all([
    getDoc(restaurantRef),
    getDoc(authorUserRef),
  ]);

  // Upsert restaurant aggregate
  let newReviewCount = 1;
  let newAverageScore = averageScore;
  if (restaurantSnap.exists()) {
    const existing = restaurantSnap.data();
    const oldCount: number = existing.reviewCount ?? 0;
    const oldAvg: number = existing.averageScore ?? 0;
    newReviewCount = oldCount + 1;
    newAverageScore =
      Math.round(((oldAvg * oldCount + averageScore) / newReviewCount) * 10) / 10;
  }
  batch.set(restaurantRef, {
    placeId,
    name: placeName,
    address: placeAddress,
    reviewCount: newReviewCount,
    averageScore: newAverageScore,
  });

  // Update author user stats
  let newTotalReviews = 1;
  let newAvgScoreGiven = averageScore;
  if (authorSnap.exists()) {
    const ud = authorSnap.data();
    const oldTotal: number = ud.totalReviews ?? 0;
    const oldAvgGiven: number = ud.averageScoreGiven ?? 0;
    newTotalReviews = oldTotal + 1;
    newAvgScoreGiven = Math.round(((oldAvgGiven * oldTotal + averageScore) / newTotalReviews) * 10) / 10;
  }
  batch.set(
    authorUserRef,
    {
      email: authorEmail,
      displayNameLower: authorEmail.toLowerCase(),
      totalReviews: newTotalReviews,
      averageScoreGiven: newAvgScoreGiven,
      ...(authorSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  // Upsert tagged participant user docs so they're discoverable by name search
  for (const uid of taggedUids) {
    const info = taggedUserMap.get(uid);
    if (!info) continue;
    const participantRef = doc(db, 'users', uid);
    batch.set(
      participantRef,
      {
        email: info.email,
        displayName: info.displayName,
        displayNameLower: info.displayName.toLowerCase(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}
