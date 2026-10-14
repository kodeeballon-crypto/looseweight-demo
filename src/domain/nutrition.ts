import type { DailyRecord, MacroKind, Macros, Meal, MealKey, NutritionAnalysis, NutritionCache, WeekPlan, Weekday } from '../types';
import { MEAL_KEYS } from '../types';
import { round1 } from './calc';

import type { Lang } from '../i18n/types';

export const MACRO_KINDS: MacroKind[] = ['protein', 'carbs', 'fat'];
export const MACRO_LABELS_MAP: Record<Lang, Record<MacroKind, string>> = {
  zh: { protein: '蛋白质', carbs: '碳水', fat: '脂肪' },
  en: { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' },
};
export const MACRO_LABELS: Record<MacroKind, string> = MACRO_LABELS_MAP.zh;

export function getMacroLabel(kind: MacroKind, lang: Lang = 'zh'): string {
  return MACRO_LABELS_MAP[lang]?.[kind] ?? MACRO_LABELS_MAP.zh[kind];
}

export const MACRO_COLORS: Record<MacroKind, string> = { protein: '#22c7e8', carbs: '#f5b544', fat: '#f0609e' };
/** 每克热量 */
const KCAL_PER_G: Record<MacroKind, number> = { protein: 4, carbs: 4, fat: 9 };
/** 减脂期热量占比参考范围（%，含边界） */
export const MACRO_RANGE: Record<MacroKind, [number, number]> = { protein: [25, 35], carbs: [40, 50], fat: [20, 30] };

export type ShareRating = 'low' | 'ok' | 'high';
export const RATING_LABELS_MAP: Record<Lang, Record<ShareRating, string>> = {
  zh: { low: '偏低', ok: '合适', high: '偏高' },
  en: { low: 'Low', ok: 'Optimal', high: 'High' },
};
export const RATING_LABELS: Record<ShareRating, string> = RATING_LABELS_MAP.zh;

export function getRatingLabel(rating: ShareRating, lang: Lang = 'zh'): string {
  return RATING_LABELS_MAP[lang]?.[rating] ?? RATING_LABELS_MAP.zh[rating];
}

export interface TodayMeals {
  keys: MealKey[];
  meals: Partial<Record<MealKey, Meal>>;
  /** true = 还没打卡，按计划预览 */
  preview: boolean;
}

/** 今日要统计的餐：已打卡取已吃的餐，未打卡预览计划 4 餐 */
export function todayMeals(plan: WeekPlan | null, record: DailyRecord | undefined, weekday: Weekday): TodayMeals {
  const day = plan?.days.find((d) => d.weekday === weekday);
  const preview = !record;
  if (!day) return { keys: [], meals: {}, preview };
  const keys = preview ? [...MEAL_KEYS] : MEAL_KEYS.filter((k) => record.mealsEaten.includes(k));
  const meals: Partial<Record<MealKey, Meal>> = {};
  for (const k of keys) meals[k] = day.meals[k];
  return { keys, meals, preview };
}

/** 餐食签名：餐次 + 菜名 + 份量 + 热量，任何变化都会使分析过期 */
export function mealSignature(keys: MealKey[], meals: Partial<Record<MealKey, Meal>>): string {
  return MEAL_KEYS.filter((k) => keys.includes(k))
    .map((k) => {
      const m = meals[k];
      return m ? `${k}|${m.name}|${m.items}|${m.kcal}` : `${k}|-`;
    })
    .join('\n');
}

/** 累加指定餐次的营养素，缺失的餐按 0 */
export function sumMacros(a: NutritionAnalysis, keys: MealKey[]): Macros {
  const total: Macros = { protein: 0, carbs: 0, fat: 0 };
  for (const k of keys) {
    const m = a.meals[k];
    if (!m) continue;
    for (const kind of MACRO_KINDS) total[kind] += m[kind];
  }
  return { protein: round1(total.protein), carbs: round1(total.carbs), fat: round1(total.fat) };
}

/** 各营养素提供的热量 */
export function macroKcal(m: Macros): Record<MacroKind, number> {
  return { protein: m.protein * KCAL_PER_G.protein, carbs: m.carbs * KCAL_PER_G.carbs, fat: m.fat * KCAL_PER_G.fat };
}

/** 热量占比（整数 %） */
export function macroShares(m: Macros): Record<MacroKind, number> {
  const k = macroKcal(m);
  const total = k.protein + k.carbs + k.fat;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((k.protein / total) * 100),
    carbs: Math.round((k.carbs / total) * 100),
    fat: Math.round((k.fat / total) * 100),
  };
}

export function rateShare(kind: MacroKind, pct: number): ShareRating {
  const [lo, hi] = MACRO_RANGE[kind];
  if (pct < lo) return 'low';
  if (pct > hi) return 'high';
  return 'ok';
}

/** 只保留最近 keep 天的分析 */
export function pruneCache(cache: NutritionCache, keep = 14): NutritionCache {
  const dates = Object.keys(cache).sort().slice(-keep);
  return Object.fromEntries(dates.map((d) => [d, cache[d]]));
}
