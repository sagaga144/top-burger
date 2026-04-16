import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { Platform } from 'react-native';
import { db, storage, auth } from './firebase';
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
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 10)) {
    throw new Error('Each score must be an integer between 1 and 10.');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

// ---- Restaurants ----

export async function getRestaurants(): Promise<RestaurantWithId[]> {
  const q = query(
    collection(db, 'restaurants'),
    orderBy('averageScore', 'desc'),
    limit(100)
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
  const q = query(collection(db, 'restaurants'), orderBy('averageScore', 'desc'), limit(100));
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
    orderBy('createdAt', 'desc'),
    limit(50)
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
    orderBy('createdAt', 'desc'),
    limit(50)
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
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');
  if (currentUid !== params.userId) throw new Error('Not authorized');

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
        displayNameLower: (userData.exists() ? userData.data().displayName || userEmail : userEmail).toLowerCase(),
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

export async function updateUsername(uid: string, username: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');
  if (currentUid !== uid) throw new Error('Not authorized');
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    displayName: username,
    displayNameLower: username.toLowerCase(),
  }, { merge: true });
}

export async function deleteReview(reviewId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');

  const reviewRef = doc(db, 'reviews', reviewId);
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) return;

  const review = reviewSnap.data();
  if (currentUid !== review.userId && currentUid !== review.authorId) {
    throw new Error('Not authorized to delete this review');
  }
  const restaurantId = review.restaurantId as string;
  const reviewScore = review.averageScore as number;
  const userId = review.userId as string;

  const restaurantRef = doc(db, 'restaurants', restaurantId);
  const userRef = doc(db, 'users', userId);
  const [restaurantSnap, userSnap] = await Promise.all([
    getDoc(restaurantRef),
    getDoc(userRef),
  ]);

  const batch = writeBatch(db);
  batch.delete(reviewRef);

  // Update restaurant aggregate
  if (restaurantSnap.exists()) {
    const r = restaurantSnap.data();
    const oldCount: number = r.reviewCount ?? 1;
    const oldAvg: number = r.averageScore ?? reviewScore;
    const newCount = oldCount - 1;
    if (newCount <= 0) {
      batch.delete(restaurantRef);
    } else {
      const newAvg = Math.round(((oldAvg * oldCount - reviewScore) / newCount) * 10) / 10;
      batch.update(restaurantRef, { reviewCount: newCount, averageScore: newAvg });
    }
  }

  // Update user stats
  if (userSnap.exists()) {
    const u = userSnap.data();
    const oldTotal: number = u.totalReviews ?? 1;
    const oldAvgGiven: number = u.averageScoreGiven ?? reviewScore;
    const newTotal = Math.max(0, oldTotal - 1);
    if (newTotal === 0) {
      batch.update(userRef, { totalReviews: 0, averageScoreGiven: 0 });
    } else {
      const newAvgGiven = Math.round(((oldAvgGiven * oldTotal - reviewScore) / newTotal) * 10) / 10;
      batch.update(userRef, { totalReviews: newTotal, averageScoreGiven: newAvgGiven });
    }
  }

  await batch.commit();
}

// ---- User Search ----

export interface UserSearchResult {
  uid: string;
  displayName: string;
}

export async function searchUsersByDisplayName(
  text: string,
  excludeUid: string
): Promise<UserSearchResult[]> {
  if (!text.trim()) return [];
  const lower = text.toLowerCase().trim();
  const end = lower + '\uf8ff';

  const nameSnap = await getDocs(query(
    collection(db, 'users'),
    where('displayNameLower', '>=', lower),
    where('displayNameLower', '<=', end),
    limit(6)
  ));

  const seen = new Set<string>();
  const results: UserSearchResult[] = [];
  nameSnap.docs.forEach(d => {
    if (d.id === excludeUid || seen.has(d.id)) return;
    seen.add(d.id);
    const data = d.data();
    results.push({
      uid: d.id,
      displayName: data.displayName || 'User',
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
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');
  if (currentUid !== params.authorUid) throw new Error('Not authorized');
  if (params.taggedUids.length > 5) throw new Error('Too many tagged companions');

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
      userEmail: participantUid === authorUid ? authorEmail : '',
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
      displayNameLower: (authorSnap.exists() ? authorSnap.data().displayName || authorEmail : authorEmail).toLowerCase(),
      totalReviews: newTotalReviews,
      averageScoreGiven: newAvgScoreGiven,
      ...(authorSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  await batch.commit();
}
