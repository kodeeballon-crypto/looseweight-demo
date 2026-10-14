import { useLang } from './store';
import { zh } from './zh';
import { en } from './en';
import type { Lang } from './types';

const DICTS = { zh, en };

function resolve(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let curr: unknown = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in (curr as Record<string, unknown>)) {
      curr = (curr as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'string' ? curr : undefined;
}

export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function getT(lang?: Lang) {
  const activeLang = lang ?? useLang.getState().lang;
  const dict = DICTS[activeLang] || DICTS.zh;
  return (key: string, params?: Record<string, string | number>): string => {
    const val =
      resolve(dict as unknown as Record<string, unknown>, key) ??
      resolve(DICTS.zh as unknown as Record<string, unknown>, key);
    if (!val) return key;
    return format(val, params);
  };
}

export function getLang(): Lang {
  return useLang.getState().lang;
}

export function useT() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const t = getT(lang);
  return { t, lang, setLang };
}

export * from './types';
export * from './store';
