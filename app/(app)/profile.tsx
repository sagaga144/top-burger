import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/authStore';
import { subscribeToUserReviews, getUserProfile } from '../../lib/firestore';
import { ReviewWithId, AppUser } from '../../types';
import RestaurantCard from '../../components/RestaurantCard';

function getInitial(email: string): string {
  return email.charAt(0).toUpperCase();
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

function getScoreColorClass(score: number): string {
  if (score >= 8) return 'text-score-high';
  if (score >= 5) return 'text-score-mid';
  return 'text-score-low';
}

interface UserCardProps {
  email: string;
}

function UserCard({ email }: UserCardProps) {
  return (
    <View
      className="bg-bg-card rounded-2xl px-5 py-5 mx-5 mt-4 mb-3 flex-row items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <View className="w-14 h-14 rounded-full bg-brand-red items-center justify-center mr-4">
        <Text className="text-2xl font-black text-text-inverse">
          {getInitial(email)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
          {email}
        </Text>
        <Text className="text-sm text-text-secondary mt-0.5">Member</Text>
      </View>
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <View
      className="flex-1 bg-bg-card rounded-2xl px-4 py-4 items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text className={`text-2xl font-black ${highlight ? 'text-brand-red' : 'text-text-primary'}`}>{value}</Text>
      <Text className="text-xs text-text-secondary mt-1 text-center">{label}</Text>
    </View>
  );
}

function EmptyReviews() {
  return (
    <View className="items-center py-12 px-8">
      <Text className="text-5xl mb-4">🍔</Text>
      <Text className="text-base font-bold text-text-primary mb-1">
        No reviews yet
      </Text>
      <Text className="text-sm text-text-secondary text-center">
        Start rating burger joints from the Rate tab!
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithId[]>([]);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const firstEmit = useRef(true);

  useEffect(() => {
    if (!user) return;
    firstEmit.current = true;

    // Load profile (one-shot)
    getUserProfile(user.uid)
      .then((p) => setProfile(p))
      .catch(() => {/* silent fail */});

    const unsubscribe = subscribeToUserReviews(
      user.uid,
      (data) => {
        setReviews(data);
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
        }
      },
      () => {
        // Silent fail — show empty state
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of Top Burger?')) {
        signOutUser();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOutUser,
        },
      ]);
    }
  };

  if (!user) return null;

  const totalReviews = reviews.length;
  const avgScore = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.averageScore, 0) / reviews.length) * 10) / 10
    : 0;

  const listHeader = (
    <View>
      <UserCard email={user.email ?? ''} />

      {/* Stats row */}
      <View className="flex-row px-5 gap-3 mb-4">
        <StatCard
          label="Reviews"
          value={String(totalReviews)}
          highlight
        />
        <StatCard
          label="Avg Score Given"
          value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
        />
      </View>

      {/* Section label */}
      {reviews.length > 0 ? (
        <View className="px-5 pb-2">
          <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            YOUR REVIEWS
          </Text>
        </View>
      ) : null}
    </View>
  );

  const listFooter = (
    <View className="px-5 pt-4 pb-8">
      <Pressable
        onPress={handleSignOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        testID="sign-out-button"
        className="h-13 rounded-xl border border-brand-red items-center justify-center"
      >
        <Text className="text-brand-red font-semibold text-base">Sign Out</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <UserCard email={user.email ?? ''} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyReviews />}
        ListFooterComponent={listFooter}
        renderItem={({ item }) => (
          <Pressable
            className="px-5"
            onPress={() =>
              router.push({
                pathname: '/(app)/summary/[reviewId]',
                params: { reviewId: item.id },
              })
            }
            accessible
            accessibilityRole="button"
            accessibilityLabel={`View review for ${item.restaurantName}`}
          >
            <RestaurantCard
              name={item.restaurantName}
              address={item.restaurantAddress}
              averageScore={item.averageScore}
              variant="compact"
              date={formatDate(item.createdAt as Parameters<typeof formatDate>[0])}
            />
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      />
    </SafeAreaView>
  );
}
