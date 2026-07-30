import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import bg from './locales/bg.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

export const SUPPORTED_LANGS = ['bg', 'ru', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANG_STORAGE_KEY = 'harmonia.lang';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bg: { translation: bg },
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: 'bg',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_STORAGE_KEY,
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
