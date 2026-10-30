import type { DayPlan, MealKey, NutritionAnalysis, WeekPlan, Weekday, WorkoutPlan } from '../types';
import { MEAL_KEYS } from '../types';

/**
 * AI 翻译结果的“守卫式”合并：只有当前数据的原文与发送翻译时的原文完全一致时才写入英文，
 * 否则丢弃（翻译期间计划被修改、重新生成、清空或导入覆盖时，旧响应不会污染新数据）。
 */

export interface MealSource {
  name: string;
  items: string;
}
export type DayMealsSource = Partial<Record<MealKey, MealSource>>;
export interface MealTranslation {
  nameEn: string;
  itemsEn: string;
}

export interface WeekPlanSource {
  days: { weekday: Weekday; meals: DayMealsSource }[];
  tips?: string[];
}

const sameList = (a?: string[], b?: string[]) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function weekPlanSource(plan: WeekPlan, weekdays?: Weekday[]): WeekPlanSource {
  const days = plan.days
    .filter((d) => !weekdays || weekdays.includes(d.weekday))
    .map((d) => ({ weekday: d.weekday, meals: Object.fromEntries(MEAL_KEYS.map((k) => [k, { name: d.meals[k].name, items: d.meals[k].items }])) }));
  return { days, ...(plan.tips?.length ? { tips: [...plan.tips] } : {}) };
}

/** 合并单日各餐翻译；返回新计划，没有可写入的内容时返回 null */
export function applyDayMealTranslation(
  current: WeekPlan | null,
  weekday: Weekday,
  source: DayMealsSource,
  tr: Partial<Record<MealKey, MealTranslation>>,
): WeekPlan | null {
  if (!current) return null;
  let changed = false;
  const days = current.days.map((d): DayPlan => {
    if (d.weekday !== weekday) return d;
    const meals = { ...d.meals };
    for (const k of MEAL_KEYS) {
      const src = source[k];
      const hit = tr[k];
      const cur = meals[k];
      if (!src || !hit?.nameEn || cur.name !== src.name || cur.items !== src.items) continue;
      meals[k] = { ...cur, nameEn: hit.nameEn, itemsEn: hit.itemsEn || cur.items };
      changed = true;
    }
    return { ...d, meals };
  });
  return changed ? { ...current, days } : null;
}

/** 合并整周翻译（AI 原始 JSON：{days:[{weekday,meals:{k:{name,items}}}], tips:[]}） */
export function applyWeekPlanTranslation(current: WeekPlan | null, source: WeekPlanSource, data: unknown): WeekPlan | null {
  if (!current || !data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const trByWeekday = new Map<number, Record<string, unknown>>();
  for (const d of Array.isArray(o.days) ? o.days : []) {
    const x = d as Record<string, unknown> | null;
    if (x && x.meals && typeof x.meals === 'object') trByWeekday.set(Number(x.weekday), x.meals as Record<string, unknown>);
  }

  let next: WeekPlan = current;
  let changed = false;
  for (const s of source.days) {
    const trMeals = trByWeekday.get(s.weekday);
    if (!trMeals) continue;
    const tr: Partial<Record<MealKey, MealTranslation>> = {};
    for (const k of MEAL_KEYS) {
      const m = trMeals[k] as Record<string, unknown> | undefined;
      const nameEn = str(m?.name);
      if (nameEn) tr[k] = { nameEn, itemsEn: str(m?.items) };
    }
    const merged = applyDayMealTranslation(next, s.weekday, s.meals, tr);
    if (merged) {
      next = merged;
      changed = true;
    }
  }

  const tipsEn = Array.isArray(o.tips) ? o.tips.map(str).filter(Boolean) : [];
  if (tipsEn.length && sameList(source.tips, current.tips)) {
    next = { ...next, tipsEn };
    changed = true;
  }
  return changed ? next : null;
}

export interface WorkoutSource {
  days: { weekday: Weekday; focus: string; exercises: { id: string; name: string; detail: string }[] }[];
  tips?: string[];
}

export function workoutSource(plan: WorkoutPlan): WorkoutSource {
  return {
    days: plan.days.map((d) => ({ weekday: d.weekday, focus: d.focus, exercises: d.exercises.map((e) => ({ id: e.id, name: e.name, detail: e.detail })) })),
    ...(plan.tips?.length ? { tips: [...plan.tips] } : {}),
  };
}

/** 合并训练周表翻译：重点、动作按 id 且原文一致时才写入 */
export function applyWorkoutTranslation(current: WorkoutPlan | null, source: WorkoutSource, data: unknown): WorkoutPlan | null {
  if (!current || !data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const trByWeekday = new Map<number, Record<string, unknown>>();
  for (const d of Array.isArray(o.days) ? o.days : []) {
    const x = d as Record<string, unknown> | null;
    if (x) trByWeekday.set(Number(x.weekday), x);
  }
  const srcByWeekday = new Map(source.days.map((d) => [d.weekday, d]));

  let changed = false;
  const days = current.days.map((d) => {
    const src = srcByWeekday.get(d.weekday);
    const tr = trByWeekday.get(d.weekday);
    if (!src || !tr) return d;
    const focusEn = str(tr.focus);
    const next = { ...d };
    if (focusEn && d.focus === src.focus) {
      next.focusEn = focusEn;
      changed = true;
    }
    const trList = Array.isArray(tr.exercises) ? (tr.exercises as Record<string, unknown>[]) : [];
    const trById = new Map<string, { name: string; detail: string }>();
    trList.forEach((e, idx) => {
      const id = typeof e?.id === 'string' ? e.id : src.exercises[idx]?.id;
      const name = str(e?.name);
      if (id && name) trById.set(id, { name, detail: str(e?.detail) });
    });
    const srcById = new Map(src.exercises.map((e) => [e.id, e]));
    next.exercises = d.exercises.map((e) => {
      const s = srcById.get(e.id);
      const hit = trById.get(e.id);
      if (!s || !hit || s.name !== e.name || s.detail !== e.detail) return e;
      changed = true;
      return { ...e, nameEn: hit.name, detailEn: hit.detail || e.detail };
    });
    return next;
  });

  let result: WorkoutPlan = { ...current, days };
  const tipsEn = Array.isArray(o.tips) ? o.tips.map(str).filter(Boolean) : [];
  if (tipsEn.length && sameList(source.tips, current.tips)) {
    result = { ...result, tipsEn };
    changed = true;
  }
  return changed ? result : null;
}

/** 营养点评翻译：当前缓存仍是同一次分析时才写入 */
export function applyNutritionTranslation(
  current: NutritionAnalysis | undefined,
  source: Pick<NutritionAnalysis, 'date' | 'signature' | 'summary' | 'suggestions'>,
  tr: { summaryEn: string; suggestionsEn: string[] },
): NutritionAnalysis | null {
  if (!current || !tr.summaryEn) return null;
  if (current.date !== source.date || current.signature !== source.signature || current.summary !== source.summary) return null;
  if (!sameList(current.suggestions, source.suggestions) && !(current.suggestions.length === 0 && source.suggestions.length === 0)) return null;
  return { ...current, summaryEn: tr.summaryEn, ...(tr.suggestionsEn.length ? { suggestionsEn: tr.suggestionsEn } : {}) };
}

