# 🍔 Top Burger

A mobile-first app for finding, rating, and ranking burger restaurants — anywhere in the world. Search for a place, score it across 7 categories, tag the friends who were there, and see how it stacks up on the live leaderboard.

Built with React Native + Expo, deployed to iOS, Android, and the web (as an installable PWA).

## Features

- **Global restaurant search** — search any restaurant worldwide (via [Photon](https://photon.komoot.io/), an open geocoding API built on OpenStreetMap), with an optional country filter and multilingual results. No search API key required.
- **"Can't find it?" manual entry** — add a restaurant by name/address if it's not in search results.
- **7-category rating** — each review scores *Over the Top*, *Priciness*, *Meat Quality*, *Service*, *Vibes*, *The Sides*, and *After Effect* (1–10 each), averaged into an overall score.
- **Photo uploads** — attach a photo to a review (via Cloudinary), rendered at its correct aspect ratio.
- **Eaten-with tagging** — tag up to 5 friends on a review; it's saved to everyone's profile at once.
- **Live leaderboard** — restaurants ranked by average score, updated in real time via Firestore subscriptions.
- **Profile** — a user's review history, with the ability to delete their own reviews.
- **Hebrew + English i18n** — full RTL support, with in-app language switching.
- **Installable PWA** — the web build supports "Add to Home Screen" on iOS/Android with proper safe-area handling.

## Tech Stack

| Concern | Tech |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Routing | expo-router v6 (file-based) |
| Styling | NativeWind v4 (Tailwind for RN) |
| Backend / Auth / DB | Firebase JS SDK v10 (Firestore + Auth, email/password) |
| Restaurant search | [Photon](https://photon.komoot.io/) (OpenStreetMap-based, free, no key) |
| Photo hosting | Cloudinary (unsigned upload preset) |
| Local persistence | AsyncStorage |
| i18n | i18next / react-i18next (English + Hebrew) |
| Language | TypeScript (strict) |
| Testing | Jest (jest-expo preset) |
| Web hosting | Firebase Hosting (primary) / Vercel (config present) |

## Project Structure

```
app/
├── _layout.tsx                    # Root stack + auth guard
├── +html.tsx                      # Web export HTML shell (PWA safe-area CSS)
├── (auth)/
│   └── login.tsx                  # Sign in / register / password reset
├── (app)/
│   ├── _layout.tsx                 # Tab bar (Rankings, Rate, Profile)
│   ├── index.tsx                   # Leaderboard
│   ├── search.tsx                  # Restaurant search + country filter + manual entry
│   ├── profile.tsx                 # User profile + review history
│   ├── rate/[placeId].tsx          # 7-score rating flow + photo + tag friends
│   └── summary/[reviewId].tsx      # Review summary / delete
└── restaurant/[restaurantId].tsx   # Restaurant detail — all reviews for a place

components/          # RestaurantCard, ScoreSelector, PhotoUploader, CountryPickerModal, LanguageToggle
constants/           # colors.ts (theme tokens), ratingQuestions.ts (the 7 score categories)
lib/                 # firebase(.web).ts, firestore.ts (CRUD + real-time), places.ts (Photon search), i18n(.web).ts
store/               # authStore.tsx — Firebase auth context
types/               # Shared TypeScript interfaces
locales/             # en.json, he.json
__tests__/           # Jest tests
```

## Getting Started

### Prerequisites
- Node.js and npm
- Expo CLI (`npx expo`, no global install needed)
- A Firebase project (Firestore + Auth enabled)
- A Cloudinary account with an unsigned upload preset (for photo uploads)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```bash
# Firebase configuration
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Cloudinary (unsigned upload preset — used for review photo uploads)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

> Restaurant search uses Photon and needs no API key. Firebase Storage isn't used (it requires a paid Blaze plan) — photos go to Cloudinary instead.

### Run

```bash
npm start        # Expo dev server — scan the QR code with Expo Go
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web (localhost)
```

### Test

```bash
npx jest
```

## Data Model (Firestore)

- **`restaurants`** — `placeId`, `name`, `address`, `reviewCount`, `averageScore` (aggregate, updated transactionally on each review write/delete)
- **`reviews`** — one document per participant per rating session; `scores` (the 7 categories), `averageScore`, `photoUrl`, `photoAspectRatio`, `eatenWith` (uids), `authorId`/`userId`
- **`users`** — `email`, `displayName`, `displayNameLower` (for prefix search), `totalReviews`, `averageScoreGiven`

Security rules (`firestore.rules`) require authentication for all writes, and every write path verifies `request.auth.uid` matches the acting user server-side.

## Deployment

The web build exports as static files and deploys to Firebase Hosting:

```bash
npx expo export --platform web
firebase deploy --only hosting
```

For iOS/Android builds and store submission, see `firebase.json` and your EAS project configuration.
