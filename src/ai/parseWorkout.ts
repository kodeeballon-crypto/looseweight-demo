import type { Exercise, WorkoutAdjustment, WorkoutChange, WorkoutDay, WorkoutPlan, Weekday } from '../types';
import { ParseError, extractJson, toStrList, toWeekday } from './parse';
import { exerciseId, isRestDay } from '../domain/workout';

export const EX_KCAL_MIN = 10;
export const EX_KCAL_MAX = 800;
const EX_PER_DAY_MAX = 6;

function toInt(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** 校验并规范化单个动作；kcal 必须在 10–800 */
export function normalizeExercise(raw: unknown, id: string = exerciseId()): Exercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const detail = typeof o.detail === 'string' ? o.detail.trim() : '';
  const kcal = toInt(o.kcal);
  if (!name || kcal === null || kcal < EX_KCAL_MIN || kcal > EX_KCAL_MAX) return null;
  return { id, name, detail, kcal };
}

/** 规范化一天；训练日（focus 不含“休息”）至少要有 1 个合法动作 */
function normalizeDay(raw: unknown, weekday: Weekday): WorkoutDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const focus = typeof o.focus === 'string' && o.focus.trim() ? o.focus.trim() : '训练';
  const exercises = (Array.isArray(o.exercises) ? o.exercises : [])
    .map((e) => normalizeExercise(e))
    .filter((e): e is Exercise => !!e)
    .slice(0, EX_PER_DAY_MAX);
  const day: WorkoutDay = { weekday, focus, exercises };
  if (!isRestDay(day) && exercises.length === 0) return null;
  return day;
}

/** 解析训练周表：必须 7 天 */
export function parseWorkoutPlan(text: string, now = new Date()): WorkoutPlan {
  const data = extractJson(text) as Record<string, unknown>;
  const rawDays = data && Array.isArray(data.days) ? data.days : null;
  if (!rawDays || rawDays.length < 7) throw new ParseError();

  const days: WorkoutDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = normalizeDay(rawDays[i], (i + 1) as Weekday);
    if (!d) throw new ParseError();
    days.push(d);
  }
  const tips = Array.isArray(data.tips)
    ? data.tips.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 3)
    : undefined;
  return { createdAt: now.toISOString(), days, tips };
}

/** 解析单个动作（兼容 {exercise:{...}} 包裹） */
export function parseExercise(text: string): Exercise {
  const data = extractJson(text) as Record<string, unknown>;
  const e = normalizeExercise(data?.exercise ?? data);
  if (!e) throw new ParseError();
  return e;
}

/** 解析教练对话：reply 必填；非法改动丢弃；同一天取最后一条 */
export function parseWorkoutAdjustment(text: string): WorkoutAdjustment {
  const data = extractJson(text) as Record<string, unknown>;
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  if (!reply) throw new ParseError();

  const byDay = new Map<Weekday, WorkoutChange>();
  for (const raw of Array.isArray(data.changes) ? data.changes : []) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const weekday = toWeekday(o.weekday);
    if (!weekday) continue;
    const next = normalizeDay(o.next ?? o, weekday);
    if (!next) continue;
    byDay.delete(weekday);
    byDay.set(weekday, { weekday, next });
  }

  return {
    reply,
    changes: [...byDay.values()],
    memoryAdd: toStrList(data.memoryAdd),
    memoryRemove: toStrList(data.memoryRemove),
  };
}
