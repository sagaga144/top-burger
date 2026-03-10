import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RestaurantCard from '../../components/RestaurantCard';
import { getRestaurants } from '../../lib/firestore';
import { RestaurantWithId } from '../../types';

function LiveBadge() {
  return (
    <View className="flex-row items-center bg-red-50 rounded-full px-2.5 py-1 ml-2">
      <View className="w-2 h-2 rounded-full bg-brand-red mr-1.5" />
      <Text className="text-xs font-semibold text-brand-red">LIVE</Text>
    </View>
  );
}

function HomeHeader() {
  return (
    <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
      <View>
        <Text className="text-xl font-black text-brand-red">TOP BURGER</Text>
        <Text className="text-xs text-text-secondary">Community Rankings</Text>
      </View>
      <LiveBadge />
    </View>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center px-5 py-3">
      <View className="flex-1 h-px bg-border-subtle" />
      <Text className="mx-3 text-xs font-bold text-text-secondary tracking-widest">
        {label}
      </Text>
      <View className="flex-1 h-px bg-border-subtle" />
    </View>
  );
}

interface TopThreeCardProps {
  restaurant: RestaurantWithId;
  rank: number;
}

function getRankBorderColor(rank: number): string {
  if (rank === 1) return '#F59E0B';
  if (rank === 2) return '#9CA3AF';
  if (rank === 3) return '#CD7F32';
  return '#E5E7EB';
}

function TopThreeCard({ restaurant, rank }: TopThreeCardProps) {
  const borderColor = getRankBorderColor(rank);
  return (
    <View
      className="bg-bg-card rounded-2xl mx-5 mb-2 overflow-hidden"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <RestaurantCard
        rank={rank}
        name={restaurant.name}
        address={restaurant.address}
        averageScore={restaurant.averageScore}
        reviewCount={restaurant.reviewCount}
        variant="full"
      />
    </View>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-4">🍔</Text>
      <Text className="text-lg font-bold text-text-primary mb-2">
        No rankings yet
      </Text>
      <Text className="text-sm text-text-secondary text-center">
        Be the first to rate a restaurant!
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRestaurants = useCallback(async () => {
    try {
      const data = await getRestaurants();
      setRestaurants(data);
      setError(null);
    } catch (err) {
      setError('Failed to load rankings. Pull down to refresh.');
    }
  }, []);

  useEffect(() => {
    loadRestaurants().finally(() => setLoading(false));
  }, [loadRestaurants]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRestaurants();
    setRefreshing(false);
  }, [loadRestaurants]);

  const topThree = restaurants.slice(0, 3);
  const rest = restaurants.slice(3);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <HomeHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E63946" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <HomeHeader />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-text-secondary text-center">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      {topThree.length > 0 ? (
        <>
          <View className="px-5 pb-2">
            <Text className="text-xs font-bold text-text-secondary tracking-widest mb-2">
              TOP 3
            </Text>
            {topThree.map((r, idx) => (
              <TopThreeCard key={r.id} restaurant={r} rank={idx + 1} />
            ))}
          </View>
          {rest.length > 0 ? <SectionDivider label="ALL RANKINGS" /> : null}
        </>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <HomeHeader />
      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          restaurants.length === 0 ? <EmptyState /> : null
        }
        renderItem={({ item, index }) => (
          <View className="px-5">
            <RestaurantCard
              rank={index + 4}
              name={item.name}
              address={item.address}
              averageScore={item.averageScore}
              reviewCount={item.reviewCount}
              variant="full"
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E63946"
            colors={['#E63946']}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
