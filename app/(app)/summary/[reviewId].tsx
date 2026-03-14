import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getReview, deleteReview, getUserProfile } from '../../../lib/firestore';
import { ReviewWithId, AppUser } from '../../../types';
import { RATING_QUESTIONS } from '../../../constants/ratingQuestions';
import { useAuth } from '../../../store/authStore';

function getScoreColorClass(score: number): string {
  if (score >= 8) return 'text-score-high';
  if (score >= 5) return 'text-score-mid';
  return 'text-score-low';
}

function getScoreBarColor(score: number): string {
  if (score >= 8) return '#22C55E';
  if (score >= 5) return '#F59E0B';
  return '#E63946';
}

function formatDate(timestamp: { toDate?: () => Date } | null | undefined): string {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date();
    return date.toLocaleDateString('en-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

interface DimensionRowProps {
  label: string;
  score: number;
}

function DimensionRow({ label, score }: DimensionRowProps) {
  const barColor = getScoreBarColor(score);
  const barWidth = `${(score / 10) * 100}%`;

  return (
    <View className="flex-row items-center mb-3">
      <Text className="text-sm text-text-secondary w-24" numberOfLines={1}>
        {label}
      </Text>
      <View
        className="flex-1 h-2 rounded-full mx-3 overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: barWidth, backgroundColor: barColor }}
        />
      </View>
      <Text
        className={`text-base font-black w-8 text-right ${getScoreColorClass(score)}`}
      >
        {score}
      </Text>
    </View>
  );
}

export default function SummaryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();
  const [review, setReview] = useState<ReviewWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [companions, setCompanions] = useState<{ uid: string; displayName: string }[]>([]);

  useEffect(() => {
    if (!reviewId) {
      setError('Review not found.');
      setLoading(false);
      return;
    }
    getReview(reviewId)
      .then((data) => {
        if (!data) {
          setError('Review not found.');
        } else {
          setReview(data);
        }
      })
      .catch(() => setError('Failed to load review.'))
      .finally(() => setLoading(false));
  }, [reviewId]);

  // Fetch companion display names for "Eaten with" section
  useEffect(() => {
    if (!review?.eatenWith?.length) return;
    const others = review.eatenWith.filter((uid) => uid !== review.userId);
    if (!others.length) return;
    Promise.all(
      others.map(async (uid) => {
        const profile = await getUserProfile(uid).catch(() => null);
        return {
          uid,
          displayName: (profile as AppUser & { displayName?: string } | null)?.displayName
            || (profile as AppUser | null)?.email?.split('@')[0]
            || uid.slice(0, 6),
        };
      })
    ).then(setCompanions).catch(() => {/* silent fail */});
  }, [review]);

  const handleDelete = async () => {
    if (!reviewId) return;
    setDeleting(true);
    try {
      await deleteReview(reviewId);
      router.replace('/(app)');
    } catch {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" color="#E63946" />
      </SafeAreaView>
    );
  }

  if (error || !review) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-8">
        <Text className="text-base text-text-secondary text-center mb-6">
          {error ?? 'Review not found.'}
        </Text>
        <Pressable
          onPress={() => router.replace('/(app)')}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          className="bg-brand-red rounded-xl h-13 px-8 items-center justify-center"
        >
          <Text className="text-text-inverse font-bold">Back to Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const dateString = formatDate(review.createdAt as Parameters<typeof formatDate>[0]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <View className="flex-row items-center justify-between pt-4 pb-4">
          <Text className="text-xl font-black text-text-primary">Your Review</Text>
          {dateString ? (
            <Text className="text-sm text-text-secondary">{dateString}</Text>
          ) : null}
        </View>

        {/* Restaurant info */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-text-primary" numberOfLines={2}>
            {review.restaurantName}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={1}>
            {review.restaurantAddress}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">
            Reviewed by{' '}
            <Text className="text-text-primary font-semibold">
              {review.userEmail ?? 'Unknown'}
            </Text>
          </Text>
        </View>

        {/* Big score block */}
        <View
          className="bg-bg-card rounded-2xl p-6 items-center mb-4"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text className="text-xs font-bold text-text-secondary tracking-widest mb-3">
            AVERAGE SCORE
          </Text>
          <View className="flex-row items-end">
            <Text
              className={`text-6xl font-black ${getScoreColorClass(review.averageScore)}`}
            >
              {review.averageScore.toFixed(1)}
            </Text>
            <Text className="text-2xl text-text-secondary mb-2 ml-1">/10</Text>
          </View>
        </View>

        {/* Photo (if exists) */}
        {review.photoUrl ? (
          <Image
            source={{ uri: review.photoUrl }}
            className="w-full rounded-2xl mb-4"
            style={{ height: 200 }}
            resizeMode="cover"
          />
        ) : null}

        {/* Dimension scores breakdown */}
        <View
          className="bg-bg-card rounded-2xl p-4 mb-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text className="text-xs font-bold text-text-secondary tracking-widest mb-4">
            BREAKDOWN
          </Text>
          {RATING_QUESTIONS.map((q) => {
            const score = review.scores[q.key];
            return (
              <DimensionRow key={q.key} label={q.label} score={score} />
            );
          })}
        </View>

        {/* Eaten with section */}
        {companions.length > 0 ? (
          <View className="mb-6">
            <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Eaten with
            </Text>
            <View className="flex-row flex-wrap">
              {companions.map((c) => {
                const initials = c.displayName
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <View key={c.uid} className="items-center mr-4 mb-2">
                    <View className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle items-center justify-center">
                      <Text className="text-xs font-bold text-text-primary">{initials}</Text>
                    </View>
                    <Text className="text-xs text-text-secondary mt-1" numberOfLines={1}>
                      {c.displayName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Back to home button */}
        <Pressable
          onPress={() => router.replace('/(app)')}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          testID="back-to-home-button"
          className="bg-brand-red rounded-xl h-13 items-center justify-center"
        >
          <Text className="text-text-inverse font-bold text-base">
            Back to Home
          </Text>
        </Pressable>

        {/* Delete review section — only visible to author */}
        {review.authorId === user?.uid ? (
          <View className="mt-6 items-center">
            {!showConfirm ? (
              <Pressable
                onPress={() => setShowConfirm(true)}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Delete review"
              >
                <Text className="text-sm text-brand-red">Delete review</Text>
              </Pressable>
            ) : (
              <View className="flex-row gap-3 w-full">
                <Pressable
                  onPress={() => setShowConfirm(false)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Cancel delete"
                  className="flex-1 h-11 bg-bg-card border border-border-subtle rounded-xl items-center justify-center"
                >
                  <Text className="text-text-primary font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  disabled={deleting}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete review"
                  className="flex-1 h-11 bg-brand-red rounded-xl items-center justify-center"
                  style={{ opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? (
                    <ActivityIndicator color="#F5F5F5" size="small" />
                  ) : (
                    <Text className="text-text-inverse font-semibold">Delete</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
