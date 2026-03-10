import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchRestaurantsInIsrael } from '../../lib/places';
import { PlaceResult } from '../../types';

type SearchState = 'idle' | 'loading' | 'results' | 'selected';

interface PlaceResultRowProps {
  place: PlaceResult;
  onSelect: (place: PlaceResult) => void;
}

function PlaceResultRow({ place, onSelect }: PlaceResultRowProps) {
  return (
    <Pressable
      onPress={() => onSelect(place)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Select ${place.displayName}`}
      className="bg-bg-card rounded-xl px-4 py-3.5 mb-2"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
        {place.displayName}
      </Text>
      <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={1}>
        {place.formattedAddress}
      </Text>
    </Pressable>
  );
}

interface SelectedCardProps {
  place: PlaceResult;
  onClear: () => void;
  onStartRating: () => void;
}

function SelectedCard({ place, onClear, onStartRating }: SelectedCardProps) {
  return (
    <View className="mb-4">
      <View
        className="bg-bg-card rounded-2xl px-4 py-4 border-2 border-brand-red"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-8 h-8 rounded-full bg-brand-red items-center justify-center mr-3 mt-0.5"
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
              {place.displayName}
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={2}>
              {place.formattedAddress}
            </Text>
          </View>
          <Pressable
            onPress={onClear}
            accessible
            accessibilityLabel="Deselect restaurant"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={onStartRating}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Start Rating"
        testID="start-rating-button"
        className="bg-brand-red rounded-xl h-13 items-center justify-center mt-3"
      >
        <Text className="text-text-inverse font-bold text-base">
          Start Rating
        </Text>
      </Pressable>
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setSelectedPlace(null);
    setErrorMessage(null);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!text.trim()) {
      setSearchState('idle');
      setResults([]);
      return;
    }

    setSearchState('loading');

    searchTimeout.current = setTimeout(async () => {
      try {
        const places = await searchRestaurantsInIsrael(text.trim());
        setResults(places);
        setSearchState('results');
      } catch {
        setErrorMessage('Could not search. Check your connection and try again.');
        setSearchState('idle');
      }
    }, 500);
  }, []);

  const handleSelectPlace = useCallback((place: PlaceResult) => {
    setSelectedPlace(place);
    setSearchState('selected');
    Keyboard.dismiss();
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPlace(null);
    setResults([]);
    setSearchState('idle');
    setQuery('');
  }, []);

  const handleStartRating = useCallback(() => {
    if (!selectedPlace) return;
    router.push({
      pathname: '/(app)/rate/[placeId]',
      params: {
        placeId: selectedPlace.id,
        name: selectedPlace.displayName,
        address: selectedPlace.formattedAddress,
      },
    });
  }, [selectedPlace, router]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedPlace(null);
    setSearchState('idle');
    setErrorMessage(null);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 px-5">
        {/* Header */}
        <View className="pt-4 pb-4">
          <Text className="text-xl font-black text-text-primary">
            Rate a Restaurant
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            Search for a burger place in Israel
          </Text>
        </View>

        {/* Search bar */}
        <View className="flex-row bg-bg-card border border-border-subtle rounded-2xl px-4 h-12 items-center mb-4">
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search restaurants..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            returnKeyType="search"
            testID="search-input"
            className="flex-1 ml-2 text-text-primary text-base"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={handleClearSearch}
              accessible
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Error */}
        {errorMessage ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm">{errorMessage}</Text>
          </View>
        ) : null}

        {/* Selected state */}
        {searchState === 'selected' && selectedPlace ? (
          <SelectedCard
            place={selectedPlace}
            onClear={handleClearSelection}
            onStartRating={handleStartRating}
          />
        ) : null}

        {/* Loading state */}
        {searchState === 'loading' ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#E63946" />
            <Text className="text-sm text-text-secondary mt-3">Searching...</Text>
          </View>
        ) : null}

        {/* Results */}
        {searchState === 'results' ? (
          results.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base font-semibold text-text-primary mb-1">
                No restaurants found
              </Text>
              <Text className="text-sm text-text-secondary text-center">
                Try a different search term
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PlaceResultRow place={item} onSelect={handleSelectPlace} />
              )}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )
        ) : null}

        {/* Idle state */}
        {searchState === 'idle' && !errorMessage ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-4xl mb-4">🔍</Text>
            <Text className="text-base font-semibold text-text-primary mb-1">
              Find a burger joint
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              Search by name or location to start rating
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
