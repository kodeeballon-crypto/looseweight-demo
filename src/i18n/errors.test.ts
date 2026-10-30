import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLang } from './index';
import { LocalizedError } from './errors';
import { AiError, chat } from '../ai/client';
import { ParseError } from '../ai/parse';
import { validateImport } from '../store/dataio';
import { AI_PRESETS, DEFAULT_SETTINGS } from '../config/ai';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

afterEach(() => {
  useLang.getState().setLang('zh');
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
});

describe('本地化错误', () => {
  it('错误文案跟随当前语言，code 稳定', () => {
    useLang.getState().setLang('zh');
    expect(new AiError('aiError.unauthorized').message).toContain('API Key 无效');
    useLang.getState().setLang('en');
    const e = new AiError('aiError.unauthorized', undefined, 401);
    expect(e.message).toBe('Invalid API key or insufficient permissions. Please check Settings.');
    expect(e.code).toBe('aiError.unauthorized');
    expect(e.status).toBe(401);
    expect(e).toBeInstanceOf(LocalizedError);
  });

  it('ParseError 与导入错误在英文模式下为英文', () => {
    useLang.getState().setLang('en');
    expect(new ParseError().message).toBe('The AI response format was invalid. Please try again.');
    expect(() => validateImport({ app: 'other' })).toThrow('This is not a backup file exported by this app');
    expect(() =>
      validateImport({ app: 'looseweight', records: [{ date: 'x', weightKg: 80 }], profile: null, plan: null, seenBadges: [] }),
    ).toThrow('Check-in record #1 is invalid');
  });

  it('chat 的 HTTP 错误按语言归一化并带上服务端详情', async () => {
    useLang.getState().setLang('en');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })));
    await expect(chat({ ...DEFAULT_SETTINGS, apiKey: 'sk-x' }, [], { timeoutMs: 1000 })).rejects.toThrow(
      'Incorrect endpoint URL or model name (model not found)',
    );
  });
});

describe('AI 配置集中管理', () => {
  it('默认设置来自第一个预设', () => {
    expect(DEFAULT_SETTINGS.baseUrl).toBe(AI_PRESETS[0].baseUrl);
    expect(DEFAULT_SETTINGS.model).toBe(AI_PRESETS[0].model);
    expect(DEFAULT_SETTINGS.apiKey).toBe('');
  });
});

