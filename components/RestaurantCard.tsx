import React from 'react';
import { View, Text } from 'react-native';

interface RestaurantCardProps {
  rank?: number;
  name: string;
  address: string;
  averageScore: number;
  reviewCount?: number;
  variant: 'full' | 'compact';
  date?: string;
}

function getScoreColorClass(score: number): string {
  if (score >= 8) return 'text-score-high';
  if (score >= 5) return 'text-score-mid';
  return 'text-score-low';
}

function getRankBgClass(rank: number): string {
  if (rank === 1) return 'bg-rank-gold';
  if (rank === 2) return 'bg-rank-silver';
  if (rank === 3) return 'bg-rank-bronze';
  return 'bg-rank-default';
}

function getRankTextClass(rank: number): string {
  if (rank <= 3) return 'text-text-inverse';
  return 'text-text-primary';
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

interface RankBadgeProps {
  rank: number;
}

function RankBadge({ rank }: RankBadgeProps) {
  return (
    <View
      className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${getRankBgClass(rank)}`}
    >
      <Text className={`text-sm font-bold ${getRankTextClass(rank)}`}>
        {rank}
      </Text>
    </View>
  );
}

export default function RestaurantCard({
  rank,
  name,
  address,
  averageScore,
  reviewCount,
  variant,
  date,
}: RestaurantCardProps) {

  if (variant === 'compact') {
    return (
      <View
        className="bg-bg-card rounded-2xl px-4 py-3 mb-2 flex-row items-center justify-between"
        style={cardShadow}
      >
        <View className="flex-1 mr-3">
          <Text
            className="text-base font-semibold text-text-primary"
            numberOfLines={1}
          >
            {name}
          </Text>
          {date ? (
            <Text className="text-xs text-text-secondary mt-0.5">{date}</Text>
          ) : null}
        </View>
        <Text
          className={`text-xl font-black ${getScoreColorClass(averageScore)}`}
        >
          {averageScore.toFixed(1)}
        </Text>
      </View>
    );
  }

  // Full variant
  return (
    <View
      className="bg-bg-card rounded-2xl px-4 py-3.5 mb-2 flex-row items-center"
      style={cardShadow}
    >
      {rank !== undefined ? <RankBadge rank={rank} /> : null}
      <View className="flex-1 mr-2">
        <Text
          className="text-base font-semibold text-text-primary"
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          className="text-xs text-text-secondary mt-0.5"
          numberOfLines={1}
        >
          {address}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`text-2xl font-black ${getScoreColorClass(averageScore)}`}
        >
          {averageScore.toFixed(1)}
        </Text>
        {reviewCount !== undefined ? (
          <Text className="text-xs text-text-secondary">
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
