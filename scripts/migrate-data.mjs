#!/usr/bin/env node
/**
 * One-off data migration for the tightened Firestore rules. Uses the Admin SDK,
 * which bypasses security rules, so run it yourself against production:
 *
 *   npm install --no-save firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/outside/the/repo/key.json
 *   node scripts/migrate-data.mjs            # dry run: prints what would change
 *   node scripts/migrate-data.mjs --apply    # writes the changes
 *
 * The project id comes from .firebaserc (override with GCLOUD_PROJECT).
 * Get a key in Firebase console > Project settings > Service accounts, and
 * delete it there once the migration is done.
 *
 * What it does:
 *  1. reviews: backfills userName (from the owner's displayName, else the
 *     email prefix the restaurant page used to show) and deletes userEmail.
 *  2. users: deletes email, and deletes a displayNameLower that is really an
 *     email (older saves fell back to the email when there was no name).
 *  3. Recomputes every restaurant's reviewCount/averageScore and every user's
 *     totalReviews/averageScoreGiven from the review documents, fixing the
 *     drift from tagged sessions saved before the aggregate fixes. Restaurants
 *     left with no reviews are deleted, as the app does on the last delete.
 */
import { readFileSync } from 'fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

// Project id: GCLOUD_PROJECT if set, else the default project in .firebaserc
const projectId =
  process.env.GCLOUD_PROJECT ||
  JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects.default;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(`No credentials. Point GOOGLE_APPLICATION_CREDENTIALS at a service-account key for ${projectId}:
  Firebase console > Project settings > Service accounts > Generate new private key
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/migrate-data.mjs`);
  process.exit(1);
}

initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId }
    : { credential: applicationDefault(), projectId }
);
const db = getFirestore();
console.log(`Project: ${projectId}${process.env.FIRESTORE_EMULATOR_HOST ? ' (emulator)' : ''}${APPLY ? '' : ' — dry run'}\n`);

const round1 = (n) => Math.round(n * 10) / 10;
const pending = [];
function plan(description, op) {
  console.log(`${APPLY ? 'WRITE' : 'would'}  ${description}`);
  pending.push(op);
}

const [usersSnap, reviewsSnap, restaurantsSnap] = await Promise.all([
  db.collection('users').get(),
  db.collection('reviews').get(),
  db.collection('restaurants').get(),
]);
const users = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));

// Aggregates rebuilt from the review documents
const byRestaurant = new Map();
const byUser = new Map();
const add = (map, key, score) => {
  const agg = map.get(key) ?? { count: 0, sum: 0 };
  agg.count += 1;
  agg.sum += score;
  map.set(key, agg);
};

// 1. Reviews
for (const d of reviewsSnap.docs) {
  const r = d.data();
  add(byRestaurant, r.restaurantId, r.averageScore);
  add(byUser, r.userId, r.averageScore);

  if (!('userEmail' in r) && 'userName' in r) continue;
  const owner = users.get(r.userId);
  const userName = r.userName || owner?.displayName || (r.userEmail ? r.userEmail.split('@')[0] : '');
  plan(`reviews/${d.id}: userName=${JSON.stringify(userName)}, delete userEmail`, (batch) =>
    batch.update(d.ref, { userName, userEmail: FieldValue.delete() }));
}

// 2 + 3. Users
for (const d of usersSnap.docs) {
  const u = d.data();
  const agg = byUser.get(d.id) ?? { count: 0, sum: 0 };
  const update = {};
  if ('email' in u) update.email = FieldValue.delete();
  if (!u.displayName && typeof u.displayNameLower === 'string' && u.displayNameLower.includes('@')) {
    update.displayNameLower = FieldValue.delete();
  }
  const total = agg.count;
  const avg = total ? round1(agg.sum / total) : 0;
  if (u.totalReviews !== total) update.totalReviews = total;
  if (u.averageScoreGiven !== avg) update.averageScoreGiven = avg;
  if (Object.keys(update).length === 0) continue;
  const summary = Object.keys(update)
    .map((k) => (update[k] instanceof FieldValue ? `delete ${k}` : `${k}=${update[k]}`))
    .join(', ');
  plan(`users/${d.id}: ${summary}`, (batch) => batch.update(d.ref, update));
}

// 3. Restaurants
for (const d of restaurantsSnap.docs) {
  const r = d.data();
  const agg = byRestaurant.get(d.id);
  if (!agg) {
    plan(`restaurants/${d.id}: no reviews left, delete`, (batch) => batch.delete(d.ref));
    continue;
  }
  const avg = round1(agg.sum / agg.count);
  if (r.reviewCount === agg.count && r.averageScore === avg) continue;
  plan(`restaurants/${d.id}: reviewCount ${r.reviewCount}→${agg.count}, averageScore ${r.averageScore}→${avg}`,
    (batch) => batch.update(d.ref, { reviewCount: agg.count, averageScore: avg }));
}

if (!APPLY) {
  console.log(`\n${pending.length} change(s). Dry run only; re-run with --apply to write them.`);
  process.exit(0);
}

// Firestore batches hold up to 500 writes
for (let i = 0; i < pending.length; i += 500) {
  const batch = db.batch();
  pending.slice(i, i + 500).forEach((op) => op(batch));
  await batch.commit();
}
console.log(`\nApplied ${pending.length} change(s).`);
