import type {
  Activity,
  DailyRecord,
  DayPlan,
  DoneExercise,
  Meal,
  MealKey,
  PlanChatMessage,
  Profile,
  Settings,
  TrainingPrefs,
  WeekPlan,
  Weekday,
  WorkoutLog,
  WorkoutPlan,
} from '../types';
import { MEAL_KEYS } from '../types';
import { normalizeMeal } from '../ai/parse';
import { ACTIVITY_FACTOR } from '../domain/calc';
import { isLifestyle } from '../domain/lifestyle';
import { CHAT_MAX, MEMORY_MAX } from '../domain/planChat';
import { isPrefs } from '../domain/workout';
import { inRange, type LimitKey } from '../config/limits';
import { LocalizedError } from '../i18n/errors';

export interface ExportData {
  app: 'looseweight';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  records: DailyRecord[];
  plan: WeekPlan | null;
  seenBadges: string[];
  settings?: Partial<Omit<Settings, 'apiKey'>>;
  planMemory?: string[];
  planChat?: PlanChatMessage[];
  trainingPrefs?: TrainingPrefs | null;
  workoutPlan?: WorkoutPlan | null;
  workoutLog?: WorkoutLog;
  workoutChat?: PlanChatMessage[];
  workoutMemory?: string[];
}

/** 导出所需的状态切片 */
export type ExportSource = Pick<
  ExportData,
  'profile' | 'records' | 'plan' | 'seenBadges' | 'planMemory' | 'planChat' | 'trainingPrefs' | 'workoutPlan' | 'workoutLog' | 'workoutChat' | 'workoutMemory'
> & { settings: Settings };

/** 生成备份对象（不含 API Key） */
export function buildExport(s: ExportSource, now = new Date()): ExportData {
  const { apiKey: _omit, ...safeSettings } = s.settings;
  void _omit;
  return {
    app: 'looseweight',
    version: 1,
    exportedAt: now.toISOString(),
    profile: s.profile,
    records: s.records,
    plan: s.plan,
    seenBadges: s.seenBadges,
    planMemory: s.planMemory,
    planChat: s.planChat,
    trainingPrefs: s.trainingPrefs,
    workoutPlan: s.workoutPlan,
    workoutLog: s.workoutLog,
    workoutChat: s.workoutChat,
    workoutMemory: s.workoutMemory,
    settings: safeSettings,
  };
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

/** 严格的 YYYY-MM-DD，且必须是真实存在的日期（拒绝 2026-02-30） */
const isDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** 数字或数字字符串 → number；其他 → null */
const toNum = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return isNum(n) ? n : null;
};
const ranged = (v: unknown, key: LimitKey): number | null => {
  const n = toNum(v);
  return n !== null && inRange(n, key) ? n : null;
};
const toStrings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : undefined;

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
  if (!Array.isArray(wp.days) || wp.days.length !== 7) throw new LocalizedError('importError.workoutIncomplete');
  for (const d of wp.days as { exercises?: unknown }[]) {
    if (!d || !Array.isArray(d.exercises)) throw new LocalizedError('importError.workoutIncomplete');
    for (const e of d.exercises as Record<string, unknown>[]) {
      if (!e || typeof e.id !== 'string' || typeof e.name !== 'string' || !e.name.trim() || !isNum(e.kcal) || e.kcal <= 0)
        throw new LocalizedError('importError.workoutExercise');
    }
  }
  return wp as unknown as WorkoutPlan;
}

/** 规范化单餐并限制热量范围 */
function toMeal(raw: unknown): Meal | null {
  const m = normalizeMeal(raw);
  return m && inRange(m.kcal, 'mealKcal') ? m : null;
}

function toProfile(v: unknown): Profile | null {
  if (!v) return null;
  const p = v as Record<string, unknown>;
  const heightCm = ranged(p.heightCm, 'heightCm');
  const startWeightKg = ranged(p.startWeightKg, 'weightKg');
  const targetWeightKg = ranged(p.targetWeightKg, 'weightKg');
  const age = ranged(p.age, 'age');
  if (heightCm === null || startWeightKg === null || targetWeightKg === null || age === null) throw new LocalizedError('importError.profileIncomplete');
  if (p.sex !== 'male' && p.sex !== 'female') throw new LocalizedError('importError.profileSex');
  if (typeof p.activity !== 'string' || !Object.hasOwn(ACTIVITY_FACTOR, p.activity)) throw new LocalizedError('importError.profileActivity');
  if (!isDate(p.startDate)) throw new LocalizedError('importError.profileStartDate');
  const profile: Profile = { heightCm, startWeightKg, targetWeightKg, age, sex: p.sex, activity: p.activity as Activity, startDate: p.startDate };
  if (typeof p.preferences === 'string') profile.preferences = p.preferences;
  if (isLifestyle(p.lifestyle)) profile.lifestyle = p.lifestyle;
  return profile;
}

function toSnapshot(v: unknown, eaten: MealKey[]): DailyRecord['mealSnapshot'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: Partial<Record<MealKey, Meal>> = {};
  for (const k of eaten) {
    const m = toMeal(o[k]);
    if (m) out[k] = m;
  }
  return Object.keys(out).length ? out : undefined;
}

function toRecords(v: unknown): DailyRecord[] {
  if (!Array.isArray(v)) throw new LocalizedError('importError.recordsMissing');
  const seen = new Set<string>();
  return v.map((r, i) => {
    const x = (r ?? {}) as Record<string, unknown>;
    const bad = () => new LocalizedError('importError.recordInvalid', { n: i + 1 });
    if (!isDate(x.date)) throw bad();
    const weightKg = ranged(x.weightKg, 'weightKg');
    if (weightKg === null) throw bad();
    let extraKcal: number | undefined;
    if (x.extraKcal !== undefined && x.extraKcal !== null) {
      const n = ranged(x.extraKcal, 'extraKcal');
      if (n === null) throw bad();
      extraKcal = n > 0 ? Math.round(n) : undefined;
    }
    if (seen.has(x.date)) throw new LocalizedError('importError.recordDuplicate', { date: x.date });
    seen.add(x.date);
    const raw = Array.isArray(x.mealsEaten) ? x.mealsEaten : [];
    const mealsEaten = MEAL_KEYS.filter((k) => raw.includes(k));
    const rec: DailyRecord = { date: x.date, weightKg, mealsEaten };
    if (extraKcal !== undefined) rec.extraKcal = extraKcal;
    if (typeof x.encouragement === 'string') rec.encouragement = x.encouragement;
    if (typeof x.encouragementEn === 'string') rec.encouragementEn = x.encouragementEn;
    const snap = toSnapshot(x.mealSnapshot, mealsEaten);
    if (snap) rec.mealSnapshot = snap;
    return rec;
  });
}

function toPlan(v: unknown): WeekPlan | null {
  if (!v) return null;
  const pl = v as Record<string, unknown>;
  const fail = () => new LocalizedError('importError.planIncomplete');
  if (!Array.isArray(pl.days) || pl.days.length !== 7) throw fail();
  const byWeekday = new Map<Weekday, DayPlan>();
  for (const raw of pl.days as Record<string, unknown>[]) {
    const w = toNum(raw?.weekday);
    if (w === null || !Number.isInteger(w) || w < 1 || w > 7 || byWeekday.has(w as Weekday)) throw new LocalizedError('importError.planWeekday');
    const mealsRaw = (raw.meals ?? {}) as Record<string, unknown>;
    const meals = {} as Record<MealKey, Meal>;
    for (const k of MEAL_KEYS) {
      const m = toMeal(mealsRaw[k]);
      if (!m) throw new LocalizedError('importError.planMeal');
      meals[k] = m;
    }
    byWeekday.set(w as Weekday, { weekday: w as Weekday, meals });
  }
  const dailyKcalTarget = ranged(pl.dailyKcalTarget, 'dailyKcalTarget');
  if (dailyKcalTarget === null) throw new LocalizedError('importError.planTarget');
  const plan: WeekPlan = {
    createdAt: typeof pl.createdAt === 'string' ? pl.createdAt : '',
    dailyKcalTarget: Math.round(dailyKcalTarget),
    days: [...byWeekday.values()].sort((a, b) => a.weekday - b.weekday),
  };
  const tips = toStrings(pl.tips);
  const tipsEn = toStrings(pl.tipsEn);
  if (tips) plan.tips = tips;
  if (tipsEn?.length) plan.tipsEn = tipsEn;
  return plan;
}

function toSettings(v: unknown): ExportData['settings'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: NonNullable<ExportData['settings']> = {};
  if (typeof o.baseUrl === 'string' && /^https?:\/\//i.test(o.baseUrl.trim())) out.baseUrl = o.baseUrl.trim();
  if (typeof o.model === 'string' && o.model.trim()) out.model = o.model.trim();
  if (typeof o.directMode === 'boolean') out.directMode = o.directMode;
  return Object.keys(out).length ? out : undefined;
}

/** 校验并规范化导入的 JSON；不合法时抛出带原因的 Error。返回值可直接写入 store。 */
export function validateImport(raw: unknown): ExportData {
  if (!raw || typeof raw !== 'object') throw new LocalizedError('importError.notObject');
  const o = raw as Record<string, unknown>;
  if (o.app !== 'looseweight') throw new LocalizedError('importError.notBackup');

  return {
    app: 'looseweight',
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    profile: toProfile(o.profile),
    records: toRecords(o.records),
    plan: toPlan(o.plan),
    seenBadges: Array.isArray(o.seenBadges) ? o.seenBadges.filter((s): s is string => typeof s === 'string') : [],
    settings: toSettings(o.settings),
    planMemory: toMemory(o.planMemory),
    planChat: toChat(o.planChat),
    trainingPrefs: isPrefs(o.trainingPrefs) ? o.trainingPrefs : null,
    workoutPlan: toWorkoutPlan(o.workoutPlan),
    workoutLog: toWorkoutLog(o.workoutLog),
    workoutChat: toChat(o.workoutChat),
    workoutMemory: toMemory(o.workoutMemory),
  };
}
