import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../types';

/** 内存版 localStorage，模拟“关闭页面再打开”：同一份 Map 在重新加载模块后仍然存在 */
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
});

const loadStore = async () => {
  vi.resetModules();
  return (await import('./useStore')).useStore;
};

describe('useStore 持久化', () => {
  beforeEach(() => mem.clear());

  it('写入后重新加载模块（模拟重开网页）数据仍在', async () => {
    const s1 = await loadStore();
    s1.getState().setProfile({ heightCm: 170 } as unknown as Profile);
    s1.getState().upsertRecord({ date: '2026-10-13', weightKg: 74.5 } as never);
    expect(mem.get('looseweight-v1')).toContain('74.5');

    const s2 = await loadStore();
    expect(s2.getState().profile).toEqual({ heightCm: 170 });
    expect(s2.getState().records).toHaveLength(1);
  });
});
