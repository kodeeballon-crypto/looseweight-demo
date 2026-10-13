import type { DailyRecord, DoneExercise, PlanChatMessage, Profile, Settings, TrainingPrefs, WeekPlan, WorkoutLog, WorkoutPlan } from '../types';
import { MEAL_KEYS } from '../types';
import { normalizeMeal } from '../ai/parse';
import { isLifestyle } from '../domain/lifestyle';
import { CHAT_MAX, MEMORY_MAX } from '../domain/planChat';
import { isPrefs } from '../domain/workout';

export interface ExportData {
  app: 'looseweight';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  records: DailyRecord[];
  plan: WeekPlan | null;
  seenBadges: string[];
  settings?: Omit<Settings, 'apiKey'>;
  planMemory?: string[];
  planChat?: PlanChatMessage[];
  trainingPrefs?: TrainingPrefs | null;
  workoutPlan?: WorkoutPlan | null;
  workoutLog?: WorkoutLog;
  workoutChat?: PlanChatMessage[];
  workoutMemory?: string[];
}

function toChat(v: unknown): PlanChatMessage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is PlanChatMessage => {
      const o = x as Record<string, unknown> | null;
      return !!o && typeof o.id === 'string' && (o.role === 'user' || o.role === 'assistant') && typeof o.text === 'string' && typeof o.at === 'string';
    })
    .slice(-CHAT_MAX);
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function toMemory(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(-MEMORY_MAX) : [];
}

function isDone(x: unknown): x is DoneExercise {
  const o = x as Record<string, unknown> | null;
  return !!o && typeof o.id === 'string' && typeof o.name === 'string' && isNum(o.kcal) && o.kcal > 0;
}

function toWorkoutLog(v: unknown): WorkoutLog {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: WorkoutLog = {};
  for (const [date, list] of Object.entries(v as Record<string, unknown>)) {
    if (!isDate(date) || !Array.isArray(list)) continue;
    const done = list.filter(isDone).map((e) => ({ id: e.id, name: e.name, kcal: e.kcal }));
    if (done.length) out[date] = done;
  }
  return out;
}

function toWorkoutPlan(v: unknown): WorkoutPlan | null {
  if (!v) return null;
  const wp = v as Record<string, unknown>;
  if (!Array.isArray(wp.days) || wp.days.length !== 7) throw new Error('训练计划数据不完整');
  for (const d of wp.days as { exercises?: unknown }[]) {
    if (!d || !Array.isArray(d.exercises)) throw new Error('训练计划数据不完整');
    for (const e of d.exercises as Record<string, unknown>[]) {
      if (!e || typeof e.id !== 'string' || typeof e.name !== 'string' || !e.name.trim() || !isNum(e.kcal) || e.kcal <= 0)
        throw new Error('训练计划中有动作数据不完整');
    }
  }
  return wp as unknown as WorkoutPlan;
}

/** 校验导入的 JSON 结构；不合法时抛出带原因的 Error */
export function validateImport(raw: unknown): ExportData {
  if (!raw || typeof raw !== 'object') throw new Error('文件内容不是 JSON 对象');
  const o = raw as Record<string, unknown>;
  if (o.app !== 'looseweight') throw new Error('不是本应用导出的备份文件');

  let profile: Profile | null = null;
  if (o.profile) {
    const p = o.profile as Record<string, unknown>;
    if (!isNum(p.heightCm) || !isNum(p.startWeightKg) || !isNum(p.targetWeightKg) || !isNum(p.age))
      throw new Error('个人档案数据不完整');
    if (p.sex !== 'male' && p.sex !== 'female') throw new Error('个人档案性别字段非法');
    if (!isDate(p.startDate)) throw new Error('个人档案开始日期非法');
    profile = { ...(p as unknown as Profile) };
    if (profile.lifestyle !== undefined && !isLifestyle(profile.lifestyle)) delete profile.lifestyle;
  }

  if (!Array.isArray(o.records)) throw new Error('缺少打卡记录 records');
  const records: DailyRecord[] = o.records.map((r, i) => {
    const x = r as Record<string, unknown>;
    if (!isDate(x.date) || !isNum(x.weightKg)) throw new Error(`第 ${i + 1} 条打卡记录格式不正确`);
    return {
      date: x.date,
      weightKg: x.weightKg,
      mealsEaten: Array.isArray(x.mealsEaten) ? x.mealsEaten.filter((k) => MEAL_KEYS.includes(k)) : [],
      extraKcal: isNum(x.extraKcal) ? x.extraKcal : undefined,
      encouragement: typeof x.encouragement === 'string' ? x.encouragement : undefined,
    };
  });

  let plan: WeekPlan | null = null;
  if (o.plan) {
    const pl = o.plan as Record<string, unknown>;
    if (!Array.isArray(pl.days) || pl.days.length !== 7) throw new Error('饮食计划数据不完整');
    for (const d of pl.days as { meals?: Record<string, unknown> }[]) {
      for (const k of MEAL_KEYS) if (!normalizeMeal(d.meals?.[k])) throw new Error('饮食计划中有餐次数据不完整');
    }
    plan = pl as unknown as WeekPlan;
  }

  return {
    app: 'looseweight',
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    profile,
    records,
    plan,
    seenBadges: Array.isArray(o.seenBadges) ? o.seenBadges.filter((s): s is string => typeof s === 'string') : [],
    settings: o.settings as ExportData['settings'],
    planMemory: toMemory(o.planMemory),
    planChat: toChat(o.planChat),
    trainingPrefs: isPrefs(o.trainingPrefs) ? o.trainingPrefs : null,
    workoutPlan: toWorkoutPlan(o.workoutPlan),
    workoutLog: toWorkoutLog(o.workoutLog),
    workoutChat: toChat(o.workoutChat),
    workoutMemory: toMemory(o.workoutMemory),
  };
}
