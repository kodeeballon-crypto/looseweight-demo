import type { DailyRecord, Meal, MealKey, WeekPlan } from '../types';
import { MEAL_KEYS } from '../types';
import { weekdayOf } from './calc';

export type MealSnapshot = Partial<Record<MealKey, Meal>>;

/**
 * 为已吃的餐生成快照：优先沿用 prev 中已有的快照，缺失的从当天计划复制。
 * 没有任何餐可快照时返回 undefined。
 */
export function snapshotMeals(mealsEaten: MealKey[], date: string, plan: WeekPlan | null, prev?: MealSnapshot): MealSnapshot | undefined {
  const day = plan?.days.find((d) => d.weekday === weekdayOf(date));
  const eaten = Array.isArray(mealsEaten) ? mealsEaten : [];
  const out: MealSnapshot = {};
  for (const k of MEAL_KEYS) {
    if (!eaten.includes(k)) continue;
    const meal = prev?.[k] ?? day?.meals[k];
    if (meal) out[k] = { ...meal };
  }
  return Object.keys(out).length ? out : undefined;
}

/** 冻结单条记录：补齐缺失的快照、移除未勾选餐次的快照 */
export function freezeRecord(record: DailyRecord, plan: WeekPlan | null): DailyRecord {
  const snap = snapshotMeals(record.mealsEaten, record.date, plan, record.mealSnapshot);
  const { mealSnapshot: _old, ...rest } = record;
  return snap ? { ...rest, mealSnapshot: snap } : rest;
}

export function freezeRecords(records: DailyRecord[], plan: WeekPlan | null): DailyRecord[] {
  return records.map((r) => freezeRecord(r, plan));
}

/** 某条记录某餐实际对应的餐食：快照优先，其次当前计划 */
export function recordMeal(record: Pick<DailyRecord, 'date' | 'mealSnapshot'> | undefined, key: MealKey, plan: WeekPlan | null, date?: string): Meal | undefined {
  const snap = record?.mealSnapshot?.[key];
  if (snap) return snap;
  const d = record?.date ?? date;
  if (!d) return undefined;
  return plan?.days.find((x) => x.weekday === weekdayOf(d))?.meals[key];
}
