import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getT, getLang, useLang } from './index';
import { zh } from './zh';
import { en } from './en';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

describe('i18n core', () => {
  beforeEach(() => {
    mem.clear();
    useLang.getState().setLang('zh');
  });

  it('translates base keys in zh and en', () => {
    const tZh = getT('zh');
    const tEn = getT('en');
    expect(tZh('app.title')).toBe('轻盈');
    expect(tEn('app.title')).toBe('Lighten');
  });

  it('interpolates parameters correctly', () => {
    const tZh = getT('zh');
    const tEn = getT('en');
    expect(tZh('common.streakDays', { n: 5 })).toBe('连续 5 天');
    expect(tEn('common.streakDays', { n: 5 })).toBe('5-day streak');
  });

  it('falls back to key when missing key', () => {
    const tZh = getT('zh');
    // @ts-expect-error test nonexistent key
    expect(tZh('nonexistent.key')).toBe('nonexistent.key');
  });

  it('changes active language via useLang store', () => {
    expect(getLang()).toBe('zh');
    useLang.getState().setLang('en');
    expect(getLang()).toBe('en');
    expect(getT()('nav.today')).toBe('Today');
  });

  it('en dictionary has exact same keys as zh', () => {
    function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const full = prefix ? `${prefix}.${k}` : k;
        return typeof v === 'object' && v !== null ? getKeys(v as Record<string, unknown>, full) : [full];
      });
    }
    const zhKeys = getKeys(zh).sort();
    const enKeys = getKeys(en).sort();
    expect(enKeys).toEqual(zhKeys);
  });
});
