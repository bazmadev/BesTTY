import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, TranslationDictionary } from './locales/en';
import { ru } from './locales/ru';

export type SupportedLocale = 'en' | 'ru';

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en,
  ru,
};

const I18nContext = createContext<I18nContextType>({
  locale: 'ru',
  setLocale: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ initialLocale?: SupportedLocale; children: React.ReactNode }> = ({
  initialLocale = 'ru',
  children,
}) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  useEffect(() => {
    if (initialLocale) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
  };

  const t = (path: string, variables?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = dictionaries[locale] || dictionaries.en;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English if key missing in current locale
        let fallback: any = dictionaries.en;
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = fallback[fbKey];
          } else {
            fallback = path;
            break;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    let result = current;
    if (variables) {
      for (const [vKey, val] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{${vKey}\\}`, 'g'), String(val));
      }
    }

    return result;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
