import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { countries } from 'countries-list';

// ---- Types ----

export interface SelectedCountry {
  cca2: string;
  name: string;
  emoji: string;
}

// ---- Helpers ----

/** Derive a flag emoji from a 2-letter ISO country code using regional indicator symbols. */
function cca2ToFlagEmoji(cca2: string): string {
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  const upper = cca2.toUpperCase();
  return (
    String.fromCodePoint(base + upper.charCodeAt(0)) +
    String.fromCodePoint(base + upper.charCodeAt(1))
  );
}

// Build sorted country list once at module level
const COUNTRY_LIST: SelectedCountry[] = Object.entries(countries)
  .map(([cca2, c]) => ({
    cca2,
    name: c.name,
    emoji: cca2ToFlagEmoji(cca2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- Props ----

interface CountryPickerModalProps {
  visible: boolean;
  selectedCountry: SelectedCountry | null;
  onSelect: (country: SelectedCountry | null) => void;
  onClose: () => void;
}

// ---- Component ----

export default function CountryPickerModal({
  visible,
  selectedCountry,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const { t } = useTranslation();
  const [countryQuery, setCountryQuery] = useState('');

  const filteredCountries = useMemo(() => {
    if (!countryQuery.trim()) return COUNTRY_LIST;
    const lower = countryQuery.toLowerCase();
    return COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(lower));
  }, [countryQuery]);

  const handleSelect = (country: SelectedCountry | null) => {
    onSelect(country);
    onClose();
  };

  const handleClose = () => {
    setCountryQuery('');
    onClose();
  };

  const isAllSelected = selectedCountry === null;

  type ListItem = { type: 'all' } | { type: 'country'; data: SelectedCountry };

  const listData: ListItem[] = useMemo(() => {
    const rows: ListItem[] = [{ type: 'all' }];
    filteredCountries.forEach((c) => rows.push({ type: 'country', data: c }));
    return rows;
  }, [filteredCountries]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.60)' }}
        onPress={handleClose}
        accessible={false}
      >
        {/* Sheet — stop touch propagation so taps inside don't close the modal */}
        <Pressable
          onPress={() => {/* absorb */}}
          accessible={false}
          className="bg-bg-base rounded-t-3xl px-4 pt-4"
          style={{ paddingBottom: 80 }}
        >
          {/* Drag handle */}
          <View className="w-10 h-1 rounded-full bg-border-subtle self-center mb-4" />

          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-bold text-text-primary">
              {t('search.country.title')}
            </Text>
            <Pressable
              onPress={handleClose}
              accessible
              accessibilityLabel={t('search.country.close')}
              accessibilityRole="button"
              className="w-8 h-8 rounded-full bg-bg-card border border-border-subtle items-center justify-center"
            >
              <Ionicons name="close" size={16} color="#8E8E93" />
            </Pressable>
          </View>

          {/* Search input */}
          <View className="flex-row bg-bg-card border border-border-subtle rounded-xl px-3 h-11 items-center mb-3">
            <Ionicons name="search" size={16} color="#8E8E93" />
            <TextInput
              value={countryQuery}
              onChangeText={setCountryQuery}
              placeholder={t('search.country.searchPlaceholder')}
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              className="flex-1 ml-2 text-text-primary text-sm"
              style={{ fontSize: 14 }}
              testID="country-search-input"
            />
            {countryQuery.length > 0 ? (
              <Pressable
                onPress={() => setCountryQuery('')}
                accessible
                accessibilityLabel={t('search.country.clearSearch')}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#8E8E93" />
              </Pressable>
            ) : null}
          </View>

          {/* Country list */}
          <FlatList
            data={listData}
            keyExtractor={(item) =>
              item.type === 'all' ? '__all__' : item.data.cca2
            }
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View
                className="h-px bg-border-subtle"
                style={{ opacity: 0.5 }}
              />
            )}
            ListEmptyComponent={
              <View className="py-6 items-center">
                <Text className="text-sm text-text-secondary">
                  {t('search.country.noMatch')}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'all') {
                return (
                  <Pressable
                    onPress={() => handleSelect(null)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('search.country.allCountries')}
                    accessibilityState={{ selected: isAllSelected }}
                    className="flex-row items-center justify-between h-12"
                  >
                    <View className="flex-row items-center gap-3">
                      <Text style={{ fontSize: 20 }}>🌍</Text>
                      <Text className="text-sm text-text-primary font-medium">
                        {t('search.country.allCountries')}
                      </Text>
                    </View>
                    {isAllSelected ? (
                      <Ionicons name="checkmark" size={18} color="#E63946" />
                    ) : null}
                  </Pressable>
                );
              }

              const country = item.data;
              const isSelected = selectedCountry?.cca2 === country.cca2;

              return (
                <Pressable
                  onPress={() => handleSelect(country)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={country.name}
                  accessibilityState={{ selected: isSelected }}
                  className="flex-row items-center justify-between h-12"
                >
                  <View className="flex-row items-center gap-3">
                    <Text style={{ fontSize: 20 }}>{country.emoji}</Text>
                    <Text className="text-sm text-text-primary">
                      {country.name}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color="#E63946" />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
