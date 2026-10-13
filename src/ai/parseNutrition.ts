import type { Macros, MealKey } from '../types';
import { ParseError, extractJson } from './parse';
import { MACRO_KINDS } from '../domain/nutrition';
import { round1 } from '../domain/calc';

export const MACRO_G_MAX = 300;

export interface NutritionResult {
  meals: Partial<Record<MealKey, Macros>>;
  summary: string;
  suggestions: string[];
}

function toGram(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() ? Number(v.trim()) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MACRO_G_MAX) return null;
  return round1(n);
}

function normalizeMacros(raw: unknown): Macros | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out = {} as Macros;
  for (const kind of MACRO_KINDS) {
    const g = toGram(o[kind]);
    if (g === null) return null;
    out[kind] = g;
  }
  return out;
}

/** 解析营养分析：keys 中每餐都必须有合法的三大营养素（0–300 g），summary 必填 */
export function parseNutrition(text: string, keys: MealKey[]): NutritionResult {
  const data = extractJson(text) as Record<string, unknown>;
  const rawMeals = data && typeof data.meals === 'object' && data.meals ? (data.meals as Record<string, unknown>) : null;
  if (!rawMeals) throw new ParseError();

  const meals: Partial<Record<MealKey, Macros>> = {};
  for (const k of keys) {
    const m = normalizeMacros(rawMeals[k]);
    if (!m) throw new ParseError();
    meals[k] = m;
  }

  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  if (!summary) throw new ParseError();

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, 3)
    : [];

  return { meals, summary, suggestions };
}
