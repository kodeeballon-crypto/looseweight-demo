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

  it('v3 旧数据迁移后补齐 nutritionCache', async () => {
    mem.set('looseweight-v1', JSON.stringify({ state: { profile: { heightCm: 160 }, records: [], workoutLog: {} }, version: 3 }));
    const s = await loadStore();
    expect(s.getState().profile).toEqual({ heightCm: 160 });
    expect(s.getState().nutritionCache).toEqual({});
  });

  it('营养分析写入后持久化，只保留最近 14 天，clearAll 清空', async () => {
    const s1 = await loadStore();
    for (let d = 1; d <= 16; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      s1.getState().setNutrition({ date, signature: 's', meals: {}, summary: '好', suggestions: [], at: '' });
    }
    const s2 = await loadStore();
    const dates = Object.keys(s2.getState().nutritionCache).sort();
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-10-03');

    s2.getState().clearAll();
    expect(s2.getState().nutritionCache).toEqual({});
  });
});

const meal = (name: string, kcal: number) => ({ name, items: `${name}份量`, kcal });
const planOf = (breakfastKcal: number, name: string) => ({
  createdAt: `p-${breakfastKcal}`,
  dailyKcalTarget: 1800,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w,
    meals: { breakfast: meal(name, breakfastKcal), lunch: meal('午饭', 600), dinner: meal('晚饭', 500), snack: meal('加餐', 100) },
  })),
});

describe('useStore 打卡快照', () => {
  beforeEach(() => mem.clear());

  it('打卡时冻结餐食，换计划后历史热量不变', async () => {
    const { intakeOf } = await import('../domain/calc');
    const s = await loadStore();
    s.getState().setPlan(planOf(400, '鸡蛋') as never);
    s.getState().upsertRecord({ date: '2026-10-12', weightKg: 80, mealsEaten: ['breakfast'] });
    s.getState().setPlan(planOf(900, '面条') as never);
    const r = s.getState().records[0];
    expect(r.mealSnapshot?.breakfast?.name).toBe('鸡蛋');
    expect(intakeOf(r, s.getState().plan).kcal).toBe(400);
  });

  it('编辑记录（只改体重）保留快照与中英文鼓励语', async () => {
    const s = await loadStore();
    s.getState().setPlan(planOf(400, '鸡蛋') as never);
    s.getState().upsertRecord({ date: '2026-10-12', weightKg: 80, mealsEaten: ['breakfast'], encouragement: '加油', encouragementEn: 'Go!' });
    s.getState().setPlan(planOf(900, '面条') as never);
    s.getState().upsertRecord({ date: '2026-10-12', weightKg: 79.5, mealsEaten: ['breakfast'] });
    const r = s.getState().records[0];
    expect(r.weightKg).toBe(79.5);
    expect(r.mealSnapshot?.breakfast?.kcal).toBe(400);
    expect(r.encouragement).toBe('加油');
    expect(r.encouragementEn).toBe('Go!');
  });

  it('v4 旧记录迁移时用已保存的计划冻结一次', async () => {
    mem.set(
      'looseweight-v1',
      JSON.stringify({ state: { records: [{ date: '2026-10-12', weightKg: 80, mealsEaten: ['breakfast'] }], plan: planOf(400, '鸡蛋') }, version: 4 }),
    );
    const s = await loadStore();
    expect(s.getState().records[0].mealSnapshot?.breakfast?.kcal).toBe(400);
  });
});
