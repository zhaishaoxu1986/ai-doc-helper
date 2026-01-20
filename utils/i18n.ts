import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UI_STRINGS } from './i18n-resources/uiStrings';
import { PROMPTS } from './i18n-resources/prompts';
import { DEFAULT_MARKDOWN } from './i18n-resources/defaultMarkdown';

export type Locale = 'zh' | 'en';

const LOCALE_STORAGE_KEY = 'user_locale';

const normalizeLocale = (value?: string | null): Locale => {
  if (!value) return 'zh';
  return value.startsWith('zh') ? 'zh' : 'en';
};

export const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  return 'zh';
};

export const getPrompt = (key: string, locale: Locale, vars?: Record<string, string | number>): string => {
  const template = PROMPTS[locale][key] || PROMPTS.zh[key] || key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
};

export const isDefaultPrompt = (key: string, value: string): boolean => {
  return value === PROMPTS.zh[key] || value === PROMPTS.en[key];
};

export const getPromptWithLocale = (storageKey: string, promptKey: string, locale: Locale): string => {
  if (typeof window === 'undefined') return getPrompt(promptKey, locale);
  const stored = localStorage.getItem(storageKey);
  const nextDefault = getPrompt(promptKey, locale);
  if (!stored) return nextDefault;
  if (isDefaultPrompt(promptKey, stored) && stored !== nextDefault) {
    localStorage.setItem(storageKey, nextDefault);
    return nextDefault;
  }
  return stored;
};

export const getDefaultMarkdown = (locale: Locale): string => DEFAULT_MARKDOWN[locale] || DEFAULT_MARKDOWN.zh;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: () => ''
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
      window.dispatchEvent(new Event('i18n-change'));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setLocaleState(getInitialLocale());
    window.addEventListener('storage', handler);
    window.addEventListener('i18n-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('i18n-change', handler);
    };
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const template = UI_STRINGS[locale][key] || UI_STRINGS.zh[key] || key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useI18n = () => useContext(I18nContext);
