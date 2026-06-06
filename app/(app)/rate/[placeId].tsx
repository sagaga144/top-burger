import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import PhotoUploader from '../../../components/PhotoUploader';
import { RATING_QUESTIONS } from '../../../constants/ratingQuestions';
import { useAuth } from '../../../store/authStore';
import {
  saveReviewForMultipleUsers,
  searchUsersByDisplayName,
  UserSearchResult,
} from '../../../lib/firestore';
import { ReviewScores } from '../../../types';

type PartialScores = Partial<ReviewScores>;

// ---- Score box row ----

interface ScoreRowProps {
  label: string;
  selectedScore: number | null;
  onSelect: (score: number) => void;
}

function ScoreRow({ label, selectedScore, onSelect }: ScoreRowProps) {
  return (
    <View className="bg-bg-card border border-border-subtle rounded-xl px-4 py-3 mb-1">
      <Text className="text-sm font-semibold text-text-primary mb-2">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((n) => {
          const selected = selectedScore === n;
          return (
            <Pressable
              key={n}
              onPress={() => onSelect(n)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Score ${n} for ${label}`}
              accessibilityState={{ selected }}
              testID={`score-box-${label}-${n}`}
              className={
                selected
                  ? 'w-[42px] h-[42px] rounded-lg items-center justify-center mr-2 bg-brand-red'
                  : 'w-[42px] h-[42px] rounded-lg items-center justify-center mr-2 bg-bg-base border border-border-subtle'
              }
            >
              <Text
                className={
                  selected
                    ? 'text-sm font-bold text-text-inverse'
                    : 'text-sm text-text-primary font-medium'
                }
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---- Friend tag chip (selected) ----

interface SelectedChipProps {
  displayName: string;
  onRemove: () => void;
}

function SelectedChip({ displayName, onRemove }: SelectedChipProps) {
  return (
    <View className="flex-row items-center bg-brand-red rounded-full px-3 py-1.5 mr-2 mb-2">
      <Text className="text-sm text-text-inverse mr-1">{displayName}</Text>
      <Pressable
        onPress={onRemove}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${displayName}`}
      >
        <Ionicons name="close" size={14} color="#F5F5F5" />
      </Pressable>
    </View>
  );
}

// ---- Main screen ----

export default function RateScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    placeId: string;
    name: string;
    address: string;
  }>();

  const placeId = params.placeId ?? '';
  const restaurantName = params.name ?? 'Restaurant';
  const restaurantAddress = params.address ?? '';

  const [scores, setScores] = useState<PartialScores>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoWidth, setPhotoWidth] = useState<number | undefined>(undefined);
  const [photoHeight, setPhotoHeight] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Friend search state
  const [friendQuery, setFriendQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFriendsRef = useRef(selectedFriends);
  useEffect(() => { selectedFriendsRef.current = selectedFriends; }, [selectedFriends]);

  // Debounced friend search — selectedFriends filtered via ref to avoid re-triggering search on selection
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!friendQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsersByDisplayName(friendQuery.trim(), user.uid);
        const selectedUids = new Set(selectedFriendsRef.current.map((f) => f.uid));
        setSearchResults(results.filter((r) => !selectedUids.has(r.uid)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [friendQuery, user]);

  const MAX_COMPANIONS = 5;

  const handleSelectFriend = (friend: UserSearchResult) => {
    if (selectedFriends.length >= MAX_COMPANIONS) return;
    setSelectedFriends((prev) => [...prev, friend]);
    setFriendQuery('');
    setSearchResults([]);
  };

  const handleRemoveFriend = (uid: string) => {
    setSelectedFriends((prev) => prev.filter((f) => f.uid !== uid));
  };

  const allAnswered =
    RATING_QUESTIONS.every((q) => scores[q.key] !== undefined);

  const handleSubmit = async () => {
    if (!user) return;

    if (!allAnswered) {
      setError(t('rate.rateAllCategories'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const aspectRatio =
        photoUri && photoWidth && photoHeight
          ? photoWidth / photoHeight
          : undefined;

      await saveReviewForMultipleUsers({
        authorUid: user.uid,
        authorEmail: user.email ?? '',
        taggedUids: selectedFriends.map((f) => f.uid),
        taggedUsers: selectedFriends,
        placeId,
        placeName: restaurantName,
        placeAddress: restaurantAddress,
        scores: scores as ReviewScores,
        photoUri,
        photoAspectRatio: aspectRatio,
      });
      router.replace('/(app)');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('rate.failedSave')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle items-center justify-center"
          >
            <Ionicons name="chevron-back" size={18} color="#8E8E93" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
              {restaurantName}
            </Text>
            <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
              {restaurantAddress}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Rating questions */}
          <View className="mt-4 mb-2 pb-2">
            {RATING_QUESTIONS.map((q) => (
              <ScoreRow
                key={q.key}
                label={t(q.labelKey)}
                selectedScore={scores[q.key] ?? null}
                onSelect={(score) =>
                  setScores((prev) => ({ ...prev, [q.key]: score }))
                }
              />
            ))}
          </View>

          {/* Photo section */}
          <View className="mt-5">
            <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {t('rate.photoSection')}
            </Text>
            <PhotoUploader
              photoUri={photoUri}
              onPhotoSelected={(uri, w, h) => {
                setPhotoUri(uri);
                setPhotoWidth(w);
                setPhotoHeight(h);
              }}
              assetWidth={photoWidth}
              assetHeight={photoHeight}
            />
          </View>

          {/* I ate with section */}
          <View className="mt-5">
            <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {t('rate.ateWith')}
            </Text>
          </View>

          {/* Selected friend chips */}
          {selectedFriends.length > 0 ? (
            <View className="flex-row flex-wrap mb-2">
              {selectedFriends.map((f) => (
                <SelectedChip
                  key={f.uid}
                  displayName={f.displayName}
                  onRemove={() => handleRemoveFriend(f.uid)}
                />
              ))}
            </View>
          ) : null}

          {/* Friend search input — hidden when cap reached */}
          {selectedFriends.length < MAX_COMPANIONS ? (
            <View className="relative">
              <TextInput
                value={friendQuery}
                onChangeText={setFriendQuery}
                placeholder={t('rate.searchUsers')}
                placeholderTextColor="#8E8E93"
                accessible={true}
                accessibilityLabel="Search friends by name"
                testID="friend-search-input"
                className="bg-bg-card border border-border-subtle rounded-xl px-3 h-11 text-text-primary"
                style={{ fontSize: 16 }}
              />
              {searching ? (
                <View className="absolute right-3 top-3">
                  <ActivityIndicator size="small" />
                </View>
              ) : null}
            </View>
          ) : (
            <Text className="text-sm text-text-secondary mt-1" testID="max-companions-hint">
              {t('rate.maxCompanions')}
            </Text>
          )}

          {/* Search result chips */}
          {searchResults.length > 0 ? (
            <View className="mt-2">
              {searchResults.map((result) => (
                <Pressable
                  key={result.uid}
                  onPress={() => handleSelectFriend(result)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${result.displayName}`}
                  testID={`friend-result-${result.uid}`}
                  className="bg-bg-card border border-border-subtle rounded-xl px-3 py-2 mb-1.5 self-start"
                >
                  <Text className="text-sm font-semibold text-text-primary">{result.displayName}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Inline error banner */}
          {error ? (
            <View className="bg-error-bg border border-error-border rounded-xl px-4 py-3 mt-4">
              <Text className="text-error-text text-sm">{error}</Text>
            </View>
          ) : null}

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('rate.submit')}
            testID="submit-review-button"
            className="h-13 bg-brand-red rounded-xl items-center justify-center mt-6"
            style={{ opacity: !allAnswered || submitting ? 0.5 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text className="text-text-inverse font-bold text-base">{t('rate.submit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
