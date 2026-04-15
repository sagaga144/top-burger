// ============================================================
// Top Burger — Shared TypeScript Types
// ============================================================

import { Timestamp } from 'firebase/firestore';

// ----- Firestore Data Models -----

export interface AppUser {
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  totalReviews: number;
  averageScoreGiven: number;
}

export interface Restaurant {
  placeId: string;
  name: string;
  address: string;
  reviewCount: number;
  averageScore: number;
}

export interface ReviewScores {
  overTheTop: number;
  priciness: number;
  meatQuality: number;
  service: number;
  vibes: number;
  theSides: number;
  afterEffect: number;
}

export interface Review {
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  userId: string;
  authorId: string;
  userEmail: string;
  scores: ReviewScores;
  averageScore: number;
  photoUrl: string | null;
  eatenWith: string[];
  createdAt: Timestamp;
}

// ----- Google Places -----

export interface PlaceResult {
  id: string;
  displayName: string;
  formattedAddress: string;
}

// ----- Rating Flow -----

export interface RatingQuestion {
  id: number;
  key: keyof ReviewScores;
  labelKey: string;
  questionKey: string;
  hasPhotoUpload?: boolean;
}

// ----- UI Helpers -----

export type ScoreValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface RestaurantWithId extends Restaurant {
  id: string;
}

export interface ReviewWithId extends Review {
  id: string;
}
