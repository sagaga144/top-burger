import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/authStore';
import { subscribeToUserReviews, getUserProfile, updateUsername } from '../../lib/firestore';
import { ReviewWithId, AppUser } from '../../types';
import RestaurantCard from '../../components/RestaurantCard';
import LanguageToggle from '../../components/LanguageToggle';

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

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

interface UserCardProps {
  uid: string;
  email: string;
  displayName?: string;
  onUsernameUpdate: (newName: string) => void;
}

function UserCard({ uid, email, displayName, onUsernameUpdate }: UserCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const displayLabel = displayName ?? email.split('@')[0];

  const handleEditPress = () => {
    setEditValue(displayName ?? '');
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!USERNAME_REGEX.test(trimmed)) {
      setEditError(t('profile.usernameInvalid'));
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateUsername(uid, trimmed);
      onUsernameUpdate(trimmed);
      setIsEditing(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch {
      setEditError(t('profile.usernameInvalid'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      className="bg-bg-card rounded-2xl px-5 py-5 mx-5 mt-4 mb-3"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <View className="flex-row items-center">
        <View className="w-14 h-14 rounded-full bg-brand-red items-center justify-center mr-4">
          <Text className="text-2xl font-black text-text-inverse">
            {getInitial(email)}
          </Text>
        </View>
        <View className="flex-1">
          {isEditing ? (
            <View>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                placeholder={t('profile.usernamePlaceholder')}
                placeholderTextColor="#8E8E93"
                accessible={true}
                accessibilityLabel={t('profile.username')}
                testID="username-input"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-bg-base border border-border-subtle rounded-lg px-3 h-10 text-text-primary mb-2"
                style={{ fontSize: 15 }}
              />
              {editError ? (
                <Text className="text-xs text-error-text mb-2">{editError}</Text>
              ) : null}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.usernameSaved')}
                  testID="username-save-button"
                  className="flex-1 h-8 bg-brand-red rounded-lg items-center justify-center"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#F5F5F5" />
                  ) : (
                    <Text className="text-text-inverse text-xs font-semibold">
                      {t('profile.usernameSaved')}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleCancel}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('summary.cancel')}
                  testID="username-cancel-button"
                  className="flex-1 h-8 bg-bg-base border border-border-subtle rounded-lg items-center justify-center"
                >
                  <Text className="text-text-secondary text-xs font-semibold">
                    {t('summary.cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleEditPress}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('profile.editUsername')}
              testID="username-edit-button"
            >
              <View className="flex-row items-center">
                <Text className="text-base font-bold text-text-primary mr-2" numberOfLines={1}>
                  {displayLabel}
                </Text>
                <Ionicons name="pencil-outline" size={16} color="#E63946" />
              </View>
              {displayName ? (
                <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={1}>
                  {email}
                </Text>
              ) : (
                <View className="flex-row items-center mt-1 gap-1">
                  <Ionicons name="person-add-outline" size={12} color="#E63946" />
                  <Text className="text-xs font-semibold text-brand-red">
                    {t('profile.setUsername')}
                  </Text>
                </View>
              )}
              {savedMessage ? (
                <Text className="text-xs text-success-text mt-1">
                  {t('profile.usernameSaved')}
                </Text>
              ) : null}
            </Pressable>
          )}
        </View>
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
  const { t } = useTranslation();
  return (
    <View className="items-center py-12 px-8">
      <Text className="text-5xl mb-4">🍔</Text>
      <Text className="text-base font-bold text-text-primary mb-1">
        {t('profile.noReviews')}
      </Text>
      <Text className="text-sm text-text-secondary text-center">
        {t('profile.startRating')}
      </Text>
    </View>
  );
}

interface ReviewListItemProps {
  item: ReviewWithId;
  onPress: (id: string) => void;
}

const ReviewListItem = React.memo(function ReviewListItem({ item, onPress }: ReviewListItemProps) {
  return (
    <Pressable
      className="px-5"
      onPress={() => onPress(item.id)}
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
  );
});

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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

  const handleUsernameUpdate = useCallback((newName: string) => {
    setProfile((prev) => prev ? { ...prev, displayName: newName } : prev);
  }, []);

  const handleSignOut = useCallback(() => {
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
  }, [signOutUser]);

  const totalReviews = useMemo(() => reviews.length, [reviews]);
  const avgScore = useMemo(
    () => reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.averageScore, 0) / reviews.length) * 10) / 10
      : 0,
    [reviews]
  );

  const listHeader = useMemo(() => (
    <View>
      <UserCard
        uid={user?.uid ?? ''}
        email={user?.email ?? ''}
        displayName={profile?.displayName}
        onUsernameUpdate={handleUsernameUpdate}
      />

      {/* Stats row */}
      <View className="flex-row px-5 gap-3 mb-4">
        <StatCard
          label={t('profile.totalReviews')}
          value={String(totalReviews)}
          highlight
        />
        <StatCard
          label={t('profile.avgScore')}
          value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
        />
      </View>

      {/* Language setting */}
      <View className="bg-bg-card rounded-xl p-4 border border-border-subtle mb-4 mx-5">
        <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          {t('profile.language')}
        </Text>
        <LanguageToggle />
      </View>

      {/* Section label */}
      {reviews.length > 0 ? (
        <View className="px-5 pb-2">
          <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            {t('profile.yourReviews')}
          </Text>
        </View>
      ) : null}
    </View>
  ), [user, profile, totalReviews, avgScore, reviews.length, t, handleUsernameUpdate]);

  const listFooter = useMemo(() => (
    <View className="px-5 pt-4 pb-8">
      <Pressable
        onPress={handleSignOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('profile.signOut')}
        testID="sign-out-button"
        className="h-13 rounded-xl border border-brand-red items-center justify-center"
      >
        <Text className="text-brand-red font-semibold text-base">{t('profile.signOut')}</Text>
      </Pressable>
    </View>
  ), [handleSignOut, t]);

  const handleReviewPress = useCallback((id: string) => {
    router.push({ pathname: '/(app)/summary/[reviewId]', params: { reviewId: id } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: ReviewWithId }) => (
    <ReviewListItem item={item} onPress={handleReviewPress} />
  ), [handleReviewPress]);

  if (!user) return null;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <UserCard
          uid={user.uid}
          email={user.email ?? ''}
          displayName={profile?.displayName}
          onUsernameUpdate={handleUsernameUpdate}
        />
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
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      />
    </SafeAreaView>
  );
}
