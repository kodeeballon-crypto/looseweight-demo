import type { Meal, MealChange, WeekPlan, Weekday } from '../types';
import { MEAL_KEYS } from '../types';

export const MEMORY_MAX = 12;
export const CHAT_MAX = 30;

const key = (w: Weekday, k: string) => `${w}-${k}`;

/** 把改动合并进周表；未涉及的天/餐保持原引用 */
export function applyMealChanges(plan: WeekPlan, changes: MealChange[]): WeekPlan {
  if (changes.length === 0) return plan;
  return {
    ...plan,
    days: plan.days.map((d) => {
      const mine = changes.filter((c) => c.weekday === d.weekday);
      if (mine.length === 0) return d;
      const meals = { ...d.meals };
      for (const c of mine) meals[c.meal] = c.next;
      return { ...d, meals };
    }),
  };
}

/** 预览索引，key 与 WeekTable 的 cellId 一致：`${weekday}-${meal}` */
export function previewMap(changes: MealChange[]): Map<string, Meal> {
  return new Map(changes.map((c) => [key(c.weekday, c.meal), c.next]));
}

/** 每天四餐合计；传入 changes 时按改动后计算 */
export function dayTotals(plan: WeekPlan, changes: MealChange[] = []): Record<Weekday, number> {
  const p = previewMap(changes);
  const out = {} as Record<Weekday, number>;
  for (const d of plan.days) {
    out[d.weekday] = MEAL_KEYS.reduce((s, k) => s + (p.get(key(d.weekday, k)) ?? d.meals[k]).kcal, 0);
  }
  return out;
}

/** 按当前周表实际餐食计算的日均热量（四舍五入）；dailyKcalTarget 只是生成时的目标，不随编辑变化 */
export function avgDailyKcal(plan: WeekPlan): number {
  const totals = Object.values(dayTotals(plan));
  if (totals.length === 0) return 0;
  return Math.round(totals.reduce((s, x) => s + x, 0) / totals.length);
}

/** 合并长期记忆：先删后加，去重，超上限丢弃最旧 */
export function mergeMemory(cur: string[], add: string[], remove: string[], max = MEMORY_MAX): string[] {
  const rm = new Set(remove.map((s) => s.trim()));
  const out = cur.filter((s) => !rm.has(s.trim()));
  for (const raw of add) {
    const s = raw.trim();
    if (s && !out.some((x) => x.trim() === s)) out.push(s);
  }
  return out.slice(-max);
}

export function trimChat<T>(list: T[], max = CHAT_MAX): T[] {
  return list.length > max ? list.slice(-max) : list;
}
