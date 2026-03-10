import React, { useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';

interface ScoreSelectorProps {
  selectedScore: number | null;
  onSelect: (score: number) => void;
}

interface TileProps {
  score: number;
  selected: boolean;
  onSelect: (score: number) => void;
}

function ScoreTile({ score, selected, onSelect }: TileProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 12,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }).start();
    });
    onSelect(score);
  };

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }], flex: 1, aspectRatio: 1, margin: 4 }}
    >
      <Pressable
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Score ${score}`}
        accessibilityState={{ selected }}
        className={[
          'flex-1 items-center justify-center rounded-xl',
          selected
            ? 'bg-brand-red border-2 border-brand-red'
            : 'bg-bg-card border border-border-subtle',
        ].join(' ')}
      >
        <Text
          className={[
            'text-lg font-bold',
            selected ? 'text-text-inverse' : 'text-text-primary',
          ].join(' ')}
        >
          {score}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ScoreSelector({
  selectedScore,
  onSelect,
}: ScoreSelectorProps) {
  const topRow = [1, 2, 3, 4, 5];
  const bottomRow = [6, 7, 8, 9, 10];

  return (
    <View className="w-full">
      <View className="flex-row">
        {topRow.map((score) => (
          <ScoreTile
            key={score}
            score={score}
            selected={selectedScore === score}
            onSelect={onSelect}
          />
        ))}
      </View>
      <View className="flex-row mt-1">
        {bottomRow.map((score) => (
          <ScoreTile
            key={score}
            score={score}
            selected={selectedScore === score}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}
