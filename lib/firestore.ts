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
  runTransaction,
  serverTimestamp,
  onSnapshot,
  deleteField,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db, auth } from './firebase';
import {
  Review,
  ReviewScores,
  RestaurantWithId,
  ReviewWithId,
  AppUser,
} from '../types';
import {
  MAX_COMPANIONS,
  computeAverage,
  addToAggregate,
  removeFromAggregate,
} from './scoring';

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

// Uploads a review photo to Cloudinary via an unsigned upload preset and returns
// the hosted CDN URL. Used instead of Firebase Storage (which requires a paid
// Blaze plan). The cloud name and unsigned preset are public by design, so they
// are safe to ship in the client bundle via EXPO_PUBLIC_* env vars.
async function uploadReviewPhoto(uri: string): Promise<string> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error('Image upload is not configured.');
  }

  const formData = new FormData();
  if (Platform.OS === 'web') {
    // On web, send the image as a Blob with an explicit filename.
    const blob = await uriToBlob(uri);
    formData.append('file', blob, `review-${Date.now()}.jpg`);
  } else {
    // On native, React Native's FormData accepts a { uri, name, type } file
    // descriptor directly — no need to read the whole file into memory.
    formData.append('file', {
      uri,
      name: `review-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  }
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Photo upload failed (${response.status}). ${detail}`.trim()
    );
  }

  const data = (await response.json()) as { secure_url?: string };
  if (!data.secure_url) {
    throw new Error('Photo upload failed: no URL returned.');
  }
  return data.secure_url;
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

// Deletes one review and rolls back the restaurant and owner aggregates in a
// single transaction, so concurrent writes can't lose an update. Allowed for
// the review's owner (userId) and for the author who created it (authorId).
export async function deleteReview(reviewId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');

  const reviewRef = doc(db, 'reviews', reviewId);

  await runTransaction(db, async (transaction) => {
    const reviewSnap = await transaction.get(reviewRef);
    if (!reviewSnap.exists()) return;

    const review = reviewSnap.data();
    if (currentUid !== review.userId && currentUid !== review.authorId) {
      throw new Error('Not authorized to delete this review');
    }
    const reviewScore = review.averageScore as number;
    const restaurantRef = doc(db, 'restaurants', review.restaurantId as string);
    const userRef = doc(db, 'users', review.userId as string);

    const [restaurantSnap, userSnap] = await Promise.all([
      transaction.get(restaurantRef),
      transaction.get(userRef),
    ]);

    transaction.delete(reviewRef);

    // Restaurant aggregate: delete the restaurant when its last review goes
    if (restaurantSnap.exists()) {
      const r = restaurantSnap.data();
      const next = removeFromAggregate(r.reviewCount ?? 1, r.averageScore ?? reviewScore, reviewScore);
      if (next.count === 0) {
        transaction.delete(restaurantRef);
      } else {
        transaction.update(restaurantRef, { reviewCount: next.count, averageScore: next.average });
      }
    }

    // Owner's stats (the owner may be a tagged friend when the author deletes)
    if (userSnap.exists()) {
      const u = userSnap.data();
      const next = removeFromAggregate(u.totalReviews ?? 1, u.averageScoreGiven ?? reviewScore, reviewScore);
      transaction.update(userRef, { totalReviews: next.count, averageScoreGiven: next.average });
    }
  });
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

// ---- Save Review (atomic transaction) ----

export interface SaveReviewForMultipleUsersParams {
  authorUid: string;
  taggedUids: string[];
  placeId: string;
  placeName: string;
  placeAddress: string;
  scores: ReviewScores;
  photoUri: string | null;
  photoAspectRatio?: number;
}

// Saves one review document per participant (the author plus up to
// MAX_COMPANIONS tagged friends) and updates the restaurant aggregate and every
// participant's stats in a single transaction. Each review document counts
// once toward the restaurant's reviewCount, matching what deleteReview removes.
export async function saveReviewForMultipleUsers(
  params: SaveReviewForMultipleUsersParams
): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error('Not authenticated');
  if (currentUid !== params.authorUid) throw new Error('Not authorized');

  const {
    authorUid,
    placeId,
    scores,
    photoUri,
    photoAspectRatio,
  } = params;

  const taggedUids = Array.from(new Set(params.taggedUids)).filter((uid) => uid !== authorUid);
  if (taggedUids.length > MAX_COMPANIONS) throw new Error('Too many tagged companions');

  // Same limits as firestore.rules; Photon names are well under them
  const placeName = params.placeName.slice(0, 300);
  const placeAddress = params.placeAddress.slice(0, 500);
  const averageScore = computeAverage(scores);
  const allParticipantUids = [authorUid, ...taggedUids];

  // Upload photo once before the transaction (the upload is not transactional)
  let photoUrl: string | null = null;
  if (photoUri) {
    photoUrl = await uploadReviewPhoto(photoUri);
  }

  const restaurantRef = doc(db, 'restaurants', placeId);
  const authorRef = doc(db, 'users', authorUid);
  const taggedRefs = taggedUids.map((uid) => doc(db, 'users', uid));
  const reviewRefs = allParticipantUids.map(() => doc(collection(db, 'reviews')));

  await runTransaction(db, async (transaction) => {
    // All reads happen before any write, as transactions require
    const [restaurantSnap, authorSnap, ...taggedSnaps] = await Promise.all([
      transaction.get(restaurantRef),
      transaction.get(authorRef),
      ...taggedRefs.map((ref) => transaction.get(ref)),
    ]);

    // Each copy carries its owner's current display name (the rules check it)
    const nameOf = (snap: typeof authorSnap): string =>
      (snap.exists() ? snap.data().displayName : undefined) ?? '';
    const authorName = nameOf(authorSnap);
    const nameFor = (index: number): string =>
      index === 0 ? authorName : nameOf(taggedSnaps[index - 1]);

    // One review document per participant
    allParticipantUids.forEach((participantUid, i) => {
      transaction.set(reviewRefs[i], {
        restaurantId: placeId,
        restaurantName: placeName,
        restaurantAddress: placeAddress,
        userId: participantUid,
        authorId: authorUid,
        userName: nameFor(i),
        scores,
        averageScore,
        photoUrl,
        ...(photoUrl && photoAspectRatio != null ? { photoAspectRatio } : {}),
        eatenWith: allParticipantUids,
        createdAt: serverTimestamp(),
      });
    });

    // Restaurant aggregate. Only the aggregate fields change once the
    // restaurant exists, so a name returned in another language doesn't
    // overwrite the stored one.
    const added = allParticipantUids.length;
    if (restaurantSnap.exists()) {
      const r = restaurantSnap.data();
      const next = addToAggregate(r.reviewCount ?? 0, r.averageScore ?? 0, averageScore, added);
      transaction.update(restaurantRef, { reviewCount: next.count, averageScore: next.average });
    } else {
      transaction.set(restaurantRef, {
        placeId,
        name: placeName,
        address: placeAddress,
        reviewCount: added,
        averageScore,
      });
    }

    // Author stats. Also clears the legacy email field: emails are no longer
    // stored on user docs, which any signed-in user can read.
    const authorStats = authorSnap.exists()
      ? addToAggregate(authorSnap.data().totalReviews ?? 0, authorSnap.data().averageScoreGiven ?? 0, averageScore)
      : { count: 1, average: averageScore };
    transaction.set(
      authorRef,
      {
        ...(authorName ? { displayNameLower: authorName.toLowerCase() } : {}),
        totalReviews: authorStats.count,
        averageScoreGiven: authorStats.average,
        email: deleteField(),
        ...(authorSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

    // Tagged friends' stats, so deleting their copy later rolls back cleanly
    taggedSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const u = snap.data();
      const next = addToAggregate(u.totalReviews ?? 0, u.averageScoreGiven ?? 0, averageScore);
      transaction.update(taggedRefs[i], { totalReviews: next.count, averageScoreGiven: next.average });
    });
  });
}
