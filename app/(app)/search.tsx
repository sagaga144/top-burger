import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../lib/i18n';
import { searchRestaurants } from '../../lib/places';
import { PlaceResult } from '../../types';
import CountryPickerModal, {
  SelectedCountry,
} from '../../components/CountryPickerModal';
import { countries } from 'countries-list';

// ---- Constants ----

const COUNTRY_STORAGE_KEY = 'selectedCountryCode';

// ---- Helpers ----

function cca2ToFlagEmoji(cca2: string): string {
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  const upper = cca2.toUpperCase();
  return (
    String.fromCodePoint(base + upper.charCodeAt(0)) +
    String.fromCodePoint(base + upper.charCodeAt(1))
  );
}

function getCountryByCode(cca2: string): SelectedCountry | null {
  const entry = (countries as Record<string, { name: string }>)[cca2.toUpperCase()];
  if (!entry) return null;
  return { cca2: cca2.toUpperCase(), name: entry.name, emoji: cca2ToFlagEmoji(cca2) };
}

/** Map app locale to a Photon-supported lang param */
function getPhotonLang(): string {
  const locale = i18n.language ?? 'en';
  const prefix = locale.slice(0, 2).toLowerCase();
  if (['en', 'de', 'fr', 'it'].includes(prefix)) return prefix;
  return 'default';
}

// ---- Types ----

type SearchState = 'idle' | 'loading' | 'results' | 'selected' | 'manual';

// ---- Sub-components (unchanged from original) ----

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
        boxShadow: '0px 1px 4px rgba(0,0,0,0.06)',
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
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <View
        className="bg-bg-card rounded-2xl px-4 py-4 border-2 border-brand-red"
        style={{
          boxShadow: '0px 4px 12px rgba(0,0,0,0.18)',
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
        accessibilityLabel={t('search.startRating')}
        testID="start-rating-button"
        className="bg-brand-red rounded-xl h-13 items-center justify-center mt-3"
      >
        <Text className="text-text-inverse font-bold text-base">
          {t('search.startRating')}
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
  const { t } = useTranslation();
  const isSubmitEnabled = name.trim().length > 0;

  return (
    <View className="mb-4">
      <View
        className="bg-bg-card rounded-2xl px-4 py-4 border-2 border-brand-red"
        style={{
          boxShadow: '0px 4px 12px rgba(0,0,0,0.18)',
        }}
      >
        {/* Form header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-text-primary">
            {t('search.manualEntry')}
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
            placeholder={t('search.restaurantNameRequired')}
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
            placeholder={t('search.addressOptional')}
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
        accessibilityLabel={t('search.startRating')}
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
          {t('search.startRating')}
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
  const { t } = useTranslation();
  return (
    <View className="items-center py-4">
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('search.cantFindIt')} ${t('search.manualEntry')}`}
        testID="cant-find-it-trigger"
      >
        <Text className="text-sm text-text-secondary">
          {t('search.cantFindIt') + ' '}
          <Text className="text-brand-red font-semibold">{t('search.manualEntry')}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

// ---- Main screen ----

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Country selector state
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const prevSearchStateRef = useRef<SearchState>('idle');

  // Restore persisted country on mount
  useEffect(() => {
    AsyncStorage.getItem(COUNTRY_STORAGE_KEY)
      .then((cca2) => {
        if (cca2) {
          const country = getCountryByCode(cca2);
          if (country) setSelectedCountry(country);
        }
      })
      .catch(() => {/* silent fail */});
  }, []);

  // Core search runner — extracted so it can be triggered by both query
  // changes and country changes
  const runSearch = useCallback(
    (text: string, country: SelectedCountry | null) => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!text.trim()) {
        setSearchState('idle');
        setResults([]);
        return;
      }
      setSearchState('loading');
      searchTimeout.current = setTimeout(async () => {
        try {
          const lang = getPhotonLang();
          const places = await searchRestaurants(text.trim(), country?.cca2, lang);
          setResults(places);
          setSearchState('results');
        } catch (err) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Could not search. Check your connection and try again.'
          );
          setSearchState('idle');
        }
      }, 500);
    },
    []
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      setSelectedPlace(null);
      setErrorMessage(null);
      runSearch(text, selectedCountry);
    },
    [selectedCountry, runSearch]
  );

  const handleCountrySelect = useCallback(
    async (country: SelectedCountry | null) => {
      setSelectedCountry(country);
      // Persist selection
      try {
        if (country) {
          await AsyncStorage.setItem(COUNTRY_STORAGE_KEY, country.cca2);
        } else {
          await AsyncStorage.removeItem(COUNTRY_STORAGE_KEY);
        }
      } catch {/* silent fail */}
      // Re-run search if query is active
      if (query.trim()) {
        runSearch(query, country);
      }
    },
    [query, runSearch]
  );

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

  // Dynamic placeholder based on selected country
  const searchPlaceholder = selectedCountry
    ? t('search.country.placeholderScoped', { country: selectedCountry.name })
    : t('search.placeholder');

  // Empty-state with country filter active
  const isCountryEmptyState =
    searchState === 'results' && results.length === 0 && selectedCountry != null;

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 px-5">
        {/* Header */}
        <View className="pt-4 pb-3">
          <Text className="text-xl font-black text-text-primary">
            {t('search.title')}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {t('search.subtitle')}
          </Text>
        </View>

        {/* Country chip */}
        <Pressable
          onPress={() => setCountryPickerVisible(true)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('search.country.chipLabel', {
            name: selectedCountry?.name ?? t('search.country.allCountries'),
          })}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
          className="flex-row items-center self-start gap-1.5 bg-bg-card border border-border-subtle rounded-full px-3 mb-3"
          style={{ height: 36 }}
        >
          <Text style={{ fontSize: 16 }}>
            {selectedCountry ? selectedCountry.emoji : '🌍'}
          </Text>
          <Text className="text-sm text-text-primary">
            {selectedCountry?.name ?? t('search.country.allCountries')}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#8E8E93" />
        </Pressable>

        {/* Search bar */}
        <View className="flex-row bg-bg-card border border-border-subtle rounded-2xl px-4 h-12 items-center mb-4">
          <Ionicons name="search" size={18} color="#8E8E93" />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder={searchPlaceholder}
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
            <Text className="text-sm text-text-secondary mt-3">{t('search.searching')}</Text>
          </View>
        ) : null}

        {/* Results — country-scoped empty state */}
        {isCountryEmptyState ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base font-semibold text-text-primary mb-1">
              {t('search.country.noResults', { country: selectedCountry!.name })}
            </Text>
            <Text className="text-sm text-text-secondary text-center mb-4">
              {t('search.country.tryGlobal')}
            </Text>
            <CantFindItTrigger onPress={handleOpenManual} />
          </View>
        ) : null}

        {/* Results — normal */}
        {searchState === 'results' && !isCountryEmptyState ? (
          results.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base font-semibold text-text-primary mb-1">
                {t('search.noResults')}
              </Text>
              <Text className="text-sm text-text-secondary text-center">
                {t('search.tryDifferent')}
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
              {t('search.findBurger')}
            </Text>
            <Text className="text-sm text-text-secondary text-center">
              {t('search.searchByName')}
            </Text>
            <CantFindItTrigger onPress={handleOpenManual} />
          </View>
        ) : null}
      </View>

      {/* Country picker modal */}
      <CountryPickerModal
        visible={countryPickerVisible}
        selectedCountry={selectedCountry}
        onSelect={handleCountrySelect}
        onClose={() => setCountryPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
