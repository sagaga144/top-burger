import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToRestaurantReviews } from '../../lib/firestore';
import { ReviewWithId } from '../../types';
import { useAuth } from '../../store/authStore';

function getScoreColorClass(score: number): string {
  if (score >= 8) return 'text-score-high';
  if (score >= 5) return 'text-score-mid';
  return 'text-score-low';
}

function formatDate(timestamp: { toDate?: () => Date } | null | undefined): string {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date();
    return date.toLocaleDateString('en-IL', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

interface ReviewRowProps {
  review: ReviewWithId;
  onPress: () => void;
}

function ReviewRow({ review, onPress }: ReviewRowProps) {
  const dateStr = formatDate(review.createdAt as Parameters<typeof formatDate>[0]);
  const label = review.userEmail ? review.userEmail.split('@')[0] : 'Anonymous';

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Review by ${label}`}
      className="bg-bg-card rounded-2xl px-4 py-3.5 mb-2 flex-row items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className="w-9 h-9 rounded-full bg-brand-red items-center justify-center mr-3">
        <Text className="text-sm font-bold text-text-inverse">
          {label.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
          {label}
        </Text>
        {dateStr ? (
          <Text className="text-xs text-text-secondary mt-0.5">{dateStr}</Text>
        ) : null}
      </View>
      <Text className={`text-xl font-black mr-2 ${getScoreColorClass(review.averageScore)}`}>
        {review.averageScore.toFixed(1)}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
    </Pressable>
  );
}

interface ReviewListItemProps {
  item: ReviewWithId;
  onPress: (id: string) => void;
}

const ReviewListItem = React.memo(function ReviewListItem({ item, onPress }: ReviewListItemProps) {
  return (
    <View className="px-5">
      <ReviewRow review={item} onPress={() => onPress(item.id)} />
    </View>
  );
});

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { restaurantId, name, address } = useLocalSearchParams<{
    restaurantId: string;
    name: string;
    address: string;
  }>();

  const [reviews, setReviews] = useState<ReviewWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const firstEmit = useRef(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    firstEmit.current = true;
    const unsubscribe = subscribeToRestaurantReviews(
      restaurantId,
      (data) => {
        setReviews(data);
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
        }
      },
      () => {
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
        }
      }
    );
    return () => unsubscribe();
  }, [restaurantId]);

  const avgScore = useMemo(
    () => reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.averageScore, 0) / reviews.length) * 10) / 10
      : null,
    [reviews]
  );

  const handleReviewPress = useCallback((id: string) => {
    router.push({
      pathname: '/(app)/summary/[reviewId]',
      params: { reviewId: id },
    });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: ReviewWithId }) => (
    <ReviewListItem item={item} onPress={handleReviewPress} />
  ), [handleReviewPress]);

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle items-center justify-center"
        >
          <Ionicons name="chevron-back" size={18} color="#8E8E93" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
            {name ?? 'Restaurant'}
          </Text>
          {address ? (
            <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
              {address}
            </Text>
          ) : null}
        </View>
        {avgScore !== null ? (
          <Text className={`text-2xl font-black ${getScoreColorClass(avgScore)}`}>
            {avgScore.toFixed(1)}
          </Text>
        ) : null}
      </View>

      {/* Section label */}
      {!loading && reviews.length > 0 ? (
        <View className="px-5 pb-2">
          <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      ) : reviews.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-text-secondary text-center">No reviews yet.</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
