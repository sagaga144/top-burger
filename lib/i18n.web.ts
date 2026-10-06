import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
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
      const stored =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(STORE_LANGUAGE_KEY)
          : null;
      callback(stored ?? Localization.getLocales()[0]?.languageCode ?? 'en');
    } catch {
      callback('en');
    }
  },
  cacheUserLanguage: async (language: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORE_LANGUAGE_KEY, language);
      }
    } catch {
      // ignore
    }
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

// I18nManager.forceRTL is a no-op on the web, so mirror the layout the web
// way: react-native-web follows the document's dir attribute.
function applyDocumentDirection(lng: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = i18n.dir(lng);
}
i18n.on('languageChanged', applyDocumentDirection);
if (i18n.language) applyDocumentDirection(i18n.language);

export default i18n;
