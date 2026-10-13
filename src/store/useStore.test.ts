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

const D = '2026-10-13';
const ex = { id: 'a', name: '快走', detail: '20 分钟', kcal: 110 };

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

  it('v2 旧数据迁移后补齐训练字段并保留原数据', async () => {
    mem.set('looseweight-v1', JSON.stringify({ state: { profile: { heightCm: 160 }, records: [], planMemory: ['不吃香菜'] }, version: 2 }));
    const s = await loadStore();
    const st = s.getState();
    expect(st.profile).toEqual({ heightCm: 160 });
    expect(st.planMemory).toEqual(['不吃香菜']);
    expect(st.trainingPrefs).toBeNull();
    expect(st.workoutPlan).toBeNull();
    expect(st.workoutLog).toEqual({});
    expect(st.workoutChat).toEqual([]);
    expect(st.workoutMemory).toEqual([]);
  });

  it('勾选训练后重新加载仍在，clearAll 清空训练数据', async () => {
    const s1 = await loadStore();
    s1.getState().toggleExercise(D, ex);
    s1.getState().updateWorkoutMemory(['膝盖不好'], []);

    const s2 = await loadStore();
    expect(s2.getState().workoutLog[D]).toEqual([{ id: 'a', name: '快走', kcal: 110 }]);
    expect(s2.getState().workoutMemory).toEqual(['膝盖不好']);

    s2.getState().clearAll();
    expect(s2.getState().workoutLog).toEqual({});
    expect(s2.getState().workoutMemory).toEqual([]);
  });
});
