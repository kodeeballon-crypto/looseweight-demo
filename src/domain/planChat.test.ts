import { describe, expect, it } from 'vitest';
import type { Meal, MealChange, WeekPlan, Weekday } from '../types';
import { applyMealChanges, avgDailyKcal, dayTotals, mergeMemory, previewMap, trimChat } from './planChat';

const m = (name: string, kcal: number): Meal => ({ name, items: 'x', kcal });
const plan: WeekPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  dailyKcalTarget: 1700,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as Weekday,
    meals: { breakfast: m(`早${w}`, 400), lunch: m(`午${w}`, 600), dinner: m(`晚${w}`, 500), snack: m(`加${w}`, 200) },
  })),
};
const changes: MealChange[] = [
  { weekday: 1, meal: 'breakfast', next: m('便利店饭团', 350) },
  { weekday: 3, meal: 'lunch', next: m('外卖轻食碗', 650) },
];

describe('applyMealChanges', () => {
  it('只修改指定格子', () => {
    const next = applyMealChanges(plan, changes);
    expect(next.days[0].meals.breakfast.name).toBe('便利店饭团');
    expect(next.days[2].meals.lunch.name).toBe('外卖轻食碗');
    expect(next.days[0].meals.lunch).toBe(plan.days[0].meals.lunch);
    expect(next.days[1]).toBe(plan.days[1]);
  });
  it('不修改原对象', () => {
    applyMealChanges(plan, changes);
    expect(plan.days[0].meals.breakfast.name).toBe('早1');
  });
  it('空改动返回原计划', () => {
    expect(applyMealChanges(plan, [])).toBe(plan);
  });
});

describe('dayTotals', () => {
  it('计算每天合计，可叠加预览改动', () => {
    expect(dayTotals(plan)[1]).toBe(1700);
    const t = dayTotals(plan, changes);
    expect(t[1]).toBe(1650);
    expect(t[3]).toBe(1750);
    expect(t[2]).toBe(1700);
  });
});

describe('avgDailyKcal', () => {
  it('按实际餐食计算日均热量，而非生成时的目标值', () => {
    const edited = applyMealChanges({ ...plan, dailyKcalTarget: 1750 }, []);
    expect(avgDailyKcal(edited)).toBe(1700);
  });
  it('反映修改后的餐食并四舍五入', () => {
    // 周一 -50、周三 +50 → 总量不变
    expect(avgDailyKcal(applyMealChanges(plan, changes))).toBe(1700);
    // 只有周一 -50 → (1700*7-50)/7 ≈ 1692.86 → 1693
    expect(avgDailyKcal(applyMealChanges(plan, [changes[0]]))).toBe(1693);
  });
  it('空周表返回 0', () => {
    expect(avgDailyKcal({ ...plan, days: [] })).toBe(0);
  });
});

describe('previewMap', () => {
  it('按 cellId 建索引', () => {
    const p = previewMap(changes);
    expect(p.get('1-breakfast')?.name).toBe('便利店饭团');
    expect(p.size).toBe(2);
  });
});

describe('mergeMemory', () => {
  it('新增去重（忽略首尾空格）并追加在末尾', () => {
    expect(mergeMemory(['不吃香菜'], [' 不吃香菜 ', '工作日不做早饭'], [])).toEqual(['不吃香菜', '工作日不做早饭']);
  });
  it('删除指定条目', () => {
    expect(mergeMemory(['a', 'b', 'c'], [], ['b'])).toEqual(['a', 'c']);
  });
  it('超过上限丢弃最旧的', () => {
    const cur = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const r = mergeMemory(cur, ['new'], []);
    expect(r).toHaveLength(12);
    expect(r[0]).toBe('m1');
    expect(r.at(-1)).toBe('new');
  });
  it('忽略空字符串', () => {
    expect(mergeMemory([], ['', '  '], [])).toEqual([]);
  });
});

describe('trimChat', () => {
  it('只保留最后 N 条', () => {
    expect(trimChat([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(trimChat([1, 2], 30)).toEqual([1, 2]);
  });
});
