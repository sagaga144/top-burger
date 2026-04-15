import { memo, useCallback, useState } from 'react';
import { View, Text, Pressable, I18nManager, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../lib/i18n';

const LANG_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'he', label: 'HE' },
] as const;

function LanguageToggle() {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);

  const currentLang = i18n.language?.startsWith('he') ? 'he' : 'en';

  const handleSelect = useCallback((lang: 'en' | 'he') => {
    if (lang === currentLang) return;
    const isRTL = lang === 'he';
    const directionChanges = isRTL !== I18nManager.isRTL;
    i18n.changeLanguage(lang);
    if (directionChanges) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      setShowPrompt(true);
    }
  }, [currentLang]);

  const handleRestart = useCallback(() => {
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RNRestart = require('react-native-restart').default;
        RNRestart.Restart();
      }, 200);
    }
  }, []);

  return (
    <View>
      {/* Segmented pill */}
      <View className="w-full bg-border-subtle rounded-xl p-1 flex-row">
        {LANG_OPTIONS.map((opt) => {
          const isActive = currentLang === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => handleSelect(opt.value as 'en' | 'he')}
              className={`flex-1 rounded-lg py-2.5 items-center justify-center${isActive ? ' bg-bg-card' : ''}`}
              style={
                isActive
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }
                  : undefined
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={opt.label}
            >
              <Text
                className={`text-sm font-semibold${isActive ? ' text-text-primary' : ' text-text-secondary'}`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* RTL reload prompt */}
      {showPrompt && (
        <View
          className="mt-3 bg-bg-card rounded-xl p-4 border border-border-subtle"
          accessibilityLiveRegion="polite"
        >
          <View className="flex-row items-start gap-3">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#8E8E93"
              accessibilityElementsHidden
            />
            <View className="flex-1">
              <Text className="text-sm text-text-secondary">
                {Platform.OS === 'web'
                  ? t('language.reloadRequired')
                  : t('language.restartRequired')}
              </Text>
              <Pressable
                onPress={handleRestart}
                className="mt-3 bg-brand-red h-11 rounded-xl items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={
                  Platform.OS === 'web'
                    ? t('language.reloadPage')
                    : t('language.restartApp')
                }
              >
                <Text className="text-sm font-semibold text-white">
                  {Platform.OS === 'web'
                    ? t('language.reloadPage')
                    : t('language.restartApp')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default memo(LanguageToggle);
