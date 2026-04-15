import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import RestaurantCard from '../../components/RestaurantCard';
import { subscribeToRestaurants, getRestaurants } from '../../lib/firestore';
import { RestaurantWithId } from '../../types';

function LiveBadge() {
  return (
    <View className="flex-row items-center bg-error-bg rounded-full px-2.5 py-1 ml-2">
      <View className="w-2 h-2 rounded-full bg-brand-red mr-1.5" />
      <Text className="text-xs font-semibold text-brand-red">LIVE</Text>
    </View>
  );
}

function HomeHeader() {
  const { t } = useTranslation();
  return (
    <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
      <View>
        <Text className="text-xl font-black text-brand-red">{t('leaderboard.title')}</Text>
        <Text className="text-xs text-text-secondary">{t('leaderboard.subtitle')}</Text>
      </View>
      <LiveBadge />
    </View>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center px-5 py-3">
      <View className="flex-1 h-px bg-border-subtle" />
      <Text className="mx-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
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

function getRankStripClass(rank: number): string {
  if (rank === 1) return 'bg-rank-gold';
  if (rank === 2) return 'bg-rank-silver';
  if (rank === 3) return 'bg-rank-bronze';
  return 'bg-rank-default';
}

function TopThreeCard({ restaurant, rank }: TopThreeCardProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/restaurant/[restaurantId]' as any,
          params: { restaurantId: restaurant.id, name: restaurant.name, address: restaurant.address },
        })
      }
      accessible
      accessibilityRole="button"
      accessibilityLabel={`View reviews for ${restaurant.name}`}
      className="rounded-2xl mx-5 mb-2 pl-1 overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 }} className={getRankStripClass(rank)} />
      <RestaurantCard
        rank={rank}
        name={restaurant.name}
        address={restaurant.address}
        averageScore={restaurant.averageScore}
        reviewCount={restaurant.reviewCount}
        variant="full"
      />
    </Pressable>
  );
}

function EmptyState({ onRatePress }: { onRatePress: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-4">🍔</Text>
      <Text className="text-lg font-bold text-text-primary mb-2">
        {t('leaderboard.noRankings')}
      </Text>
      <Text className="text-sm text-text-secondary text-center">
        {t('leaderboard.beFirst')}
      </Text>
      <Pressable
        onPress={onRatePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('leaderboard.ratePlace')}
        className="bg-brand-red rounded-xl h-13 px-8 items-center justify-center mt-4"
      >
        <Text className="text-text-inverse font-bold text-base">{t('leaderboard.ratePlace')}</Text>
      </Pressable>
    </View>
  );
}

interface RestaurantListItemProps {
  item: RestaurantWithId;
  index: number;
  onPress: (item: RestaurantWithId) => void;
}

const RestaurantListItem = React.memo(function RestaurantListItem({
  item,
  index,
  onPress,
}: RestaurantListItemProps) {
  return (
    <Pressable
      className="px-5"
      onPress={() => onPress(item)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`View reviews for ${item.name}`}
    >
      <RestaurantCard
        rank={index + 4}
        name={item.name}
        address={item.address}
        averageScore={item.averageScore}
        reviewCount={item.reviewCount}
        variant="full"
      />
    </Pressable>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<RestaurantWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstEmit = useRef(true);
  // Stable ref so subscription callbacks can read the latest t() without
  // causing the effect to re-run (and the subscription to reconnect) on every
  // language change.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  useEffect(() => {
    firstEmit.current = true;

    // 3-second getDocs fallback in case onSnapshot never fires (guards Android bug)
    const fallbackTimer = setTimeout(async () => {
      if (firstEmit.current) {
        try {
          const data = await getRestaurants();
          setRestaurants(data);
          setError(null);
        } catch {
          setError(tRef.current('leaderboard.failedLoad'));
        } finally {
          if (firstEmit.current) {
            firstEmit.current = false;
            setLoading(false);
          }
        }
      }
    }, 3000);

    const unsubscribe = subscribeToRestaurants(
      (data) => {
        setRestaurants(data);
        setError(null);
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
          clearTimeout(fallbackTimer);
        }
      },
      (_err) => {
        setError(tRef.current('leaderboard.failedLoad'));
        if (firstEmit.current) {
          firstEmit.current = false;
          setLoading(false);
          clearTimeout(fallbackTimer);
        }
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getRestaurants();
      setRestaurants(data);
      setError(null);
    } catch {
      // onSnapshot stays active; silently ignore
    } finally {
      setRefreshing(false);
    }
  }, []);

  const topThree = useMemo(() => restaurants.slice(0, 3), [restaurants]);
  const rest = useMemo(() => restaurants.slice(3), [restaurants]);

  const handleRestaurantPress = useCallback((item: RestaurantWithId) => {
    router.push({
      pathname: '/restaurant/[restaurantId]' as any,
      params: { restaurantId: item.id, name: item.name, address: item.address },
    });
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: RestaurantWithId; index: number }) => (
    <RestaurantListItem item={item} index={index} onPress={handleRestaurantPress} />
  ), [handleRestaurantPress]);

  const handleRatePress = useCallback(() => {
    router.push('/(app)/search');
  }, [router]);

  const listHeader = useMemo(() => (
    <View>
      {topThree.length > 0 ? (
        <>
          <View className="px-5 pb-2">
            <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {t('leaderboard.top3')}
            </Text>
            {topThree.map((r, idx) => (
              <TopThreeCard key={r.id} restaurant={r} rank={idx + 1} />
            ))}
          </View>
          {rest.length > 0 ? <SectionDivider label={t('leaderboard.allRankings')} /> : null}
        </>
      ) : null}
    </View>
  ), [topThree, rest, t]);

  const listEmpty = useMemo(() => (
    restaurants.length === 0 ? <EmptyState onRatePress={handleRatePress} /> : null
  ), [restaurants.length, handleRatePress]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <HomeHeader />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {/* Section placeholder */}
          <View className="h-4 w-16 bg-bg-card rounded mb-4" style={{ opacity: 0.5 }} />
          {/* 3 card skeletons */}
          {[1, 2, 3].map(i => (
            <View key={i} className="bg-bg-card rounded-2xl h-20 mb-3" style={{ opacity: i === 1 ? 0.5 : i === 2 ? 0.4 : 0.3 }} />
          ))}
          {/* Divider */}
          <View className="h-px bg-border-subtle mb-4" />
          {/* 4 list skeletons */}
          {[1, 2, 3, 4].map(i => (
            <View key={i} className="bg-bg-card rounded-xl h-14 mb-2" style={{ opacity: 0.3 }} />
          ))}
        </ScrollView>
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

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <HomeHeader />
      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
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
