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

type SearchState = 'idle' | 'loading' | 'results' | 'selected' | 'manual';

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
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 6,
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
            <Ionicons name="close" size={20} color="#8E8E93" />
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

interface ManualEntryFormProps {
  name: string;
  address: string;
  onChangeName: (text: string) => void;
  onChangeAddress: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function ManualEntryForm({
  name,
  address,
  onChangeName,
  onChangeAddress,
  onSubmit,
  onCancel,
}: ManualEntryFormProps) {
  const isSubmitEnabled = name.trim().length > 0;

  return (
    <View className="mb-4">
      <View
        className="bg-bg-card rounded-2xl px-4 py-4 border-2 border-brand-red"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        {/* Form header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-text-primary">
            Enter manually
          </Text>
          <Pressable
            onPress={onCancel}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cancel manual entry"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="manual-entry-cancel"
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
          </Pressable>
        </View>

        {/* Name field */}
        <View className="bg-bg-base border border-border-subtle rounded-xl px-3 h-11 justify-center mb-2">
          <TextInput
            value={name}
            onChangeText={onChangeName}
            placeholder="Restaurant name (required)"
            placeholderTextColor="#8E8E93"
            autoCapitalize="words"
            returnKeyType="next"
            testID="manual-entry-name"
            className="text-text-primary text-sm"
          />
        </View>

        {/* Address field */}
        <View className="bg-bg-base border border-border-subtle rounded-xl px-3 h-11 justify-center">
          <TextInput
            value={address}
            onChangeText={onChangeAddress}
            placeholder="Address (optional)"
            placeholderTextColor="#8E8E93"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={isSubmitEnabled ? onSubmit : undefined}
            testID="manual-entry-address"
            className="text-text-primary text-sm"
          />
        </View>
      </View>

      {/* Start Rating button */}
      <Pressable
        onPress={isSubmitEnabled ? onSubmit : undefined}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Start Rating"
        accessibilityState={{ disabled: !isSubmitEnabled }}
        testID="manual-entry-submit"
        className={`rounded-xl h-13 items-center justify-center mt-3 ${
          isSubmitEnabled ? 'bg-brand-red' : 'bg-bg-card'
        }`}
        style={
          isSubmitEnabled
            ? undefined
            : { borderWidth: 1, borderColor: '#2C2C2E' }
        }
      >
        <Text
          className={`font-bold text-base ${
            isSubmitEnabled ? 'text-text-inverse' : 'text-text-secondary'
          }`}
        >
          Start Rating
        </Text>
      </Pressable>
    </View>
  );
}

// Trigger link shown at the bottom of idle / results / empty-results views
interface CantFindItTriggerProps {
  onPress: () => void;
}

function CantFindItTrigger({ onPress }: CantFindItTriggerProps) {
  return (
    <View className="items-center py-4">
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Can't find it? Enter manually"
        testID="cant-find-it-trigger"
      >
        <Text className="text-sm text-text-secondary">
          {"Can't find it? "}
          <Text className="text-brand-red font-semibold">Enter manually</Text>
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

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const prevSearchStateRef = useRef<SearchState>('idle');

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
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not search. Check your connection and try again.');
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

  const handleOpenManual = useCallback(() => {
    prevSearchStateRef.current = searchState;
    setManualName('');
    setManualAddress('');
    setSearchState('manual');
    Keyboard.dismiss();
  }, [searchState]);

  const handleCancelManual = useCallback(() => {
    setSearchState(prevSearchStateRef.current);
  }, []);

  const handleManualSubmit = useCallback(() => {
    const trimmedName = manualName.trim();
    if (!trimmedName) return;
    Keyboard.dismiss();
    router.push({
      pathname: '/(app)/rate/[placeId]',
      params: {
        placeId: `manual-${Date.now()}`,
        name: trimmedName,
        address: manualAddress.trim(),
      },
    });
  }, [manualName, manualAddress, router]);

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
          <Ionicons name="search" size={18} color="#8E8E93" />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search restaurants..."
            placeholderTextColor="#8E8E93"
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
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </Pressable>
          ) : null}
        </View>

        {/* Error */}
        {errorMessage ? (
          <View className="bg-error-bg border border-error-border rounded-xl px-4 py-3 mb-4">
            <Text className="text-error-text text-sm">{errorMessage}</Text>
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

        {/* Manual entry form */}
        {searchState === 'manual' ? (
          <ManualEntryForm
            name={manualName}
            address={manualAddress}
            onChangeName={setManualName}
            onChangeAddress={setManualAddress}
            onSubmit={handleManualSubmit}
            onCancel={handleCancelManual}
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
              <CantFindItTrigger onPress={handleOpenManual} />
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
              contentContainerStyle={{ paddingBottom: 8 }}
              ListFooterComponent={<CantFindItTrigger onPress={handleOpenManual} />}
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
            <CantFindItTrigger onPress={handleOpenManual} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
