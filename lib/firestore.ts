import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
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
