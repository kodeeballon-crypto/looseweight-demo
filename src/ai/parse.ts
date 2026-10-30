import type { Meal, MealChange, MealKey, PlanAdjustment, WeekPlan, DayPlan, Weekday } from '../types';
import { MEAL_KEYS } from '../types';
import { LocalizedError } from '../i18n/errors';

export class ParseError extends LocalizedError {
  constructor() {
    super('aiError.parse');
    this.name = 'ParseError';
  }
}

/** 从模型输出中提取首个 JSON 对象（容错 ```json 包裹与前后多余文字） */
export function extractJson(text: string): unknown {
  if (typeof text !== 'string') throw new ParseError();
  const start = text.indexOf('{');
  if (start < 0) throw new ParseError();

  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          throw new ParseError();
        }
      }
    }
  }
  throw new ParseError();
}

function toKcal(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** 校验并规范化单个 Meal */
export function normalizeMeal(raw: unknown): Meal | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const items = typeof o.items === 'string' ? o.items.trim() : Array.isArray(o.items) ? o.items.join('、') : '';
  const nameEn = typeof o.nameEn === 'string' ? o.nameEn.trim() : undefined;
  const itemsEn = typeof o.itemsEn === 'string' ? o.itemsEn.trim() : undefined;
  const kcal = toKcal(o.kcal);
  if (!name || kcal === null) return null;
  return { name, items, kcal, ...(nameEn ? { nameEn } : {}), ...(itemsEn ? { itemsEn } : {}) };
}

/** 解析周食谱：必须 7 天 × 4 餐，kcal 为正数 */
export function parseWeekPlan(text: string, dailyKcalTarget: number, now = new Date()): WeekPlan {
  const data = extractJson(text) as Record<string, unknown>;
  const rawDays = data && Array.isArray(data.days) ? data.days : null;
  if (!rawDays || rawDays.length < 7) throw new ParseError();

  const days: DayPlan[] = [];
  for (let i = 0; i < 7; i++) {
    const d = rawDays[i] as Record<string, unknown> | undefined;
    const mealsRaw = d?.meals as Record<string, unknown> | undefined;
    if (!mealsRaw || typeof mealsRaw !== 'object') throw new ParseError();
    const meals = {} as Record<MealKey, Meal>;
    for (const k of MEAL_KEYS) {
      const m = normalizeMeal(mealsRaw[k]);
      if (!m) throw new ParseError();
      meals[k] = m;
    }
    days.push({ weekday: (i + 1) as Weekday, meals });
  }

  const tips = Array.isArray(data.tips)
    ? data.tips.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 3)
    : undefined;

  return { createdAt: now.toISOString(), dailyKcalTarget, days, tips };
}

/** 解析单餐（兼容 {meal:{...}} 包裹） */
export function parseMeal(text: string): Meal {
  const data = extractJson(text) as Record<string, unknown>;
  const m = normalizeMeal(data?.meal ?? data);
  if (!m) throw new ParseError();
  return m;
}

/** 解析鼓励语（兼容 {text:"..."} 或纯文本） */
export function parseEncouragement(text: string): string {
  try {
    const data = extractJson(text) as Record<string, unknown>;
    const t = data?.text ?? data?.message ?? data?.encouragement;
    if (typeof t === 'string' && t.trim()) return t.trim();
  } catch {
    /* 不是 JSON，按纯文本处理 */
  }
  const plain = text.replace(/```[a-z]*|```/gi, '').trim();
  if (!plain) throw new ParseError();
  return plain;
}

const MEMORY_ITEM_MAX = 30;
const MEMORY_BATCH_MAX = 5;

export function toStrList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim().slice(0, MEMORY_ITEM_MAX))
    .slice(0, MEMORY_BATCH_MAX);
}

export function toWeekday(v: unknown): Weekday | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7 ? (n as Weekday) : null;
}

/** 解析对话调整方案：reply 必须有；非法改动条目丢弃；同一格取最后一条 */
export function parsePlanAdjustment(text: string): PlanAdjustment {
  const data = extractJson(text) as Record<string, unknown>;
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  if (!reply) throw new ParseError();

  const byCell = new Map<string, MealChange>();
  for (const raw of Array.isArray(data.changes) ? data.changes : []) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const weekday = toWeekday(o.weekday);
    const meal = MEAL_KEYS.find((k) => k === o.meal);
    const next = normalizeMeal(o.next ?? o);
    if (!weekday || !meal || !next || next.kcal < 30 || next.kcal > 1500) continue;
    const id = `${weekday}-${meal}`;
    byCell.delete(id); // 保证顺序为最后出现的位置
    byCell.set(id, { weekday, meal, next });
  }

  return {
    reply,
    changes: [...byCell.values()],
    memoryAdd: toStrList(data.memoryAdd),
    memoryRemove: toStrList(data.memoryRemove),
  };
}
