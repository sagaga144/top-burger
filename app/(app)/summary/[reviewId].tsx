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
import { getReview } from '../../../lib/firestore';
import { ReviewWithId } from '../../../types';
import { RATING_QUESTIONS } from '../../../constants/ratingQuestions';

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
      <View className="flex-1 h-2 bg-border-subtle rounded-full mx-3 overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: barWidth, backgroundColor: barColor }}
        />
      </View>
      <Text
        className={`text-sm font-bold w-8 text-right ${getScoreColorClass(score)}`}
      >
        {score}
      </Text>
    </View>
  );
}

export default function SummaryScreen() {
  const router = useRouter();
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();
  const [review, setReview] = useState<ReviewWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      </ScrollView>
    </SafeAreaView>
  );
}
