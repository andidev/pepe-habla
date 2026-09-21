import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import {
  glossLanguage, isAppLanguage, languageForLocale,
  type AppLanguage, type GlossLanguage,
} from '@pepe/core';
import { STRINGS, type Strings } from './strings';

const KEY = 'pepe-habla/language/v1';

interface LanguageState {
  language: AppLanguage;
  /** The language glosses are shown and spoken in. */
  gloss: GlossLanguage;
  t: Strings;
  /** False until the stored choice has been read, so nothing flashes in the wrong language. */
  ready: boolean;
  setLanguage: (next: AppLanguage) => void;
}

const Ctx = createContext<LanguageState | null>(null);

function deviceLanguage(): AppLanguage {
  try {
    return languageForLocale(getLocales()[0]?.languageTag ?? 'en');
  } catch {
    return 'en';
  }
}

/**
 * The app language, for every screen at once.
 *
 * A context rather than a module variable, so changing it in settings
 * re-renders the tabs behind the settings screen immediately.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<AppLanguage>(deviceLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => { if (alive && isAppLanguage(stored)) setState(stored); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const value = useMemo<LanguageState>(() => ({
    language,
    gloss: glossLanguage(language),
    t: STRINGS[language],
    ready,
    setLanguage: (next) => {
      setState(next);
      AsyncStorage.setItem(KEY, next).catch(() => {});
    },
  }), [language, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageState {
  const value = useContext(Ctx);
  if (value === null) throw new Error('useLanguage() outside <LanguageProvider>');
  return value;
}
