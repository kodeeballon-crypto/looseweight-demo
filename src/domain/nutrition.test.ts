import { describe, expect, it } from 'vitest';
import type { DailyRecord, Meal, MealKey, NutritionAnalysis, NutritionCache, WeekPlan, Weekday } from '../types';
import { macroShares, mealSignature, pruneCache, rateShare, sumMacros, todayMeals } from './nutrition';

const meal = (name: string, kcal = 400): Meal => ({ name, items: `${name}份量`, kcal });
const plan: WeekPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  dailyKcalTarget: 1600,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as Weekday,
    meals: { breakfast: meal(`早${w}`), lunch: meal(`午${w}`), dinner: meal(`晚${w}`), snack: meal(`加${w}`, 150) },
  })),
};
const rec = (mealsEaten: MealKey[]): DailyRecord => ({ date: '2026-10-13', weightKg: 60, mealsEaten });

describe('todayMeals', () => {
  it('无计划时 keys 为空', () => {
    expect(todayMeals(null, undefined, 2).keys).toEqual([]);
  });
  it('未打卡时预览计划 4 餐', () => {
    const r = todayMeals(plan, undefined, 2);
    expect(r.preview).toBe(true);
    expect(r.keys).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(r.meals.lunch?.name).toBe('午2');
  });
  it('已打卡时只取已吃的餐，并按餐次排序', () => {
    const r = todayMeals(plan, rec(['dinner', 'breakfast']), 3);
    expect(r.preview).toBe(false);
    expect(r.keys).toEqual(['breakfast', 'dinner']);
    expect(r.meals.snack).toBeUndefined();
  });
});

describe('mealSignature', () => {
  it('餐次或菜名变化时签名变化', () => {
    const { keys, meals } = todayMeals(plan, undefined, 1);
    const a = mealSignature(keys, meals);
    expect(mealSignature(keys, meals)).toBe(a);
    expect(mealSignature(['breakfast', 'lunch'], meals)).not.toBe(a);
    expect(mealSignature(keys, { ...meals, lunch: meal('别的') })).not.toBe(a);
  });
});

const analysis = (date: string): NutritionAnalysis => ({
  date,
  signature: 's',
  meals: { breakfast: { protein: 20, carbs: 50, fat: 10 }, lunch: { protein: 30.5, carbs: 60, fat: 15 } },
  summary: 'ok',
  suggestions: [],
  at: '2026-10-13T08:00:00.000Z',
});

describe('sumMacros', () => {
  it('只累加 keys 中的餐，缺失的餐按 0', () => {
    expect(sumMacros(analysis('2026-10-13'), ['breakfast'])).toEqual({ protein: 20, carbs: 50, fat: 10 });
    expect(sumMacros(analysis('2026-10-13'), ['breakfast', 'lunch', 'snack'])).toEqual({ protein: 50.5, carbs: 110, fat: 25 });
  });
});

describe('macroShares', () => {
  it('按热量（4/4/9）计算占比', () => {
    expect(macroShares({ protein: 30, carbs: 50, fat: 20 })).toEqual({ protein: 24, carbs: 40, fat: 36 });
  });
  it('全 0 时返回 0', () => {
    expect(macroShares({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe('rateShare', () => {
  it('边界值算合适', () => {
    expect(rateShare('protein', 25)).toBe('ok');
    expect(rateShare('protein', 35)).toBe('ok');
    expect(rateShare('protein', 24.9)).toBe('low');
    expect(rateShare('protein', 35.1)).toBe('high');
    expect(rateShare('carbs', 39)).toBe('low');
    expect(rateShare('fat', 31)).toBe('high');
  });
});

describe('pruneCache', () => {
  it('只保留最近 N 天', () => {
    const cache: NutritionCache = {};
    for (let d = 1; d <= 20; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      cache[date] = analysis(date);
    }
    const kept = Object.keys(pruneCache(cache, 14)).sort();
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe('2026-10-07');
    expect(kept[13]).toBe('2026-10-20');
  });
});
