import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import he from '../locales/he.json';

const STORE_LANGUAGE_KEY = 'settings.lang';

const languageDetectorPlugin = {
  type: 'languageDetector' as const,
  async: true,
  init: () => {},
  detect: async (callback: (lang: string) => void) => {
    try {
      const stored = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
      callback(stored ?? Localization.getLocales()[0]?.languageCode ?? 'en');
    } catch {
      callback('en');
    }
  },
  cacheUserLanguage: async (language: string) => {
    await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
  },
};

i18n
  .use(initReactI18next)
  .use(languageDetectorPlugin)
  .init({
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });

export default i18n;
