import { create } from 'zustand';
import type { Lang } from './types';

export const LANG_STORAGE_KEY = 'looseweight-lang';

export function detectBrowserLang(): Lang {
  if (typeof window === 'undefined' || !window.navigator) return 'zh';
  const navLang = window.navigator.language || '';
  return navLang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLang = create<LangState>((set) => {
  let initial: Lang = 'zh';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
    initial = saved === 'zh' || saved === 'en' ? saved : detectBrowserLang();
  } catch {
    initial = detectBrowserLang();
  }
  return {
    lang: initial,
    setLang: (lang) => {
      try {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      } catch {
        /* ignore */
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
      }
      set({ lang });
    },
  };
});
