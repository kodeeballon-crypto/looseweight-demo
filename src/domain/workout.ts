import type {
  DoneExercise,
  Exercise,
  TrainingDays,
  TrainingLevel,
  TrainingMinutes,
  TrainingPlace,
  TrainingPrefs,
  WorkoutChange,
  WorkoutDay,
  WorkoutLog,
  WorkoutPlan,
} from '../types';
import type { Lang } from '../i18n/types';

/** UI 选项文案 */
export const PLACE_LABELS_MAP: Record<Lang, Record<TrainingPlace, string>> = {
  zh: {
    home: '🏠 居家徒手',
    gym: '🏋️ 健身房',
    outdoor: '🌳 户外',
  },
  en: {
    home: '🏠 Home (Bodyweight)',
    gym: '🏋️ Gym',
    outdoor: '🌳 Outdoor',
  },
};

export const LEVEL_LABELS_MAP: Record<Lang, Record<TrainingLevel, string>> = {
  zh: {
    beginner: '🌱 新手',
    base: '💪 有基础',
  },
  en: {
    beginner: '🌱 Beginner',
    base: '💪 Intermediate',
  },
};

export function getPlaceLabel(p: TrainingPlace, lang: Lang = 'zh'): string {
  return PLACE_LABELS_MAP[lang]?.[p] ?? PLACE_LABELS_MAP.zh[p];
}

export function getLevelLabel(lvl: TrainingLevel, lang: Lang = 'zh'): string {
  return LEVEL_LABELS_MAP[lang]?.[lvl] ?? LEVEL_LABELS_MAP.zh[lvl];
}

export const PLACE_LABELS = PLACE_LABELS_MAP.zh;
export const LEVEL_LABELS = LEVEL_LABELS_MAP.zh;
export const MINUTE_OPTIONS: TrainingMinutes[] = [20, 30, 45, 60];
export const DAY_OPTIONS: TrainingDays[] = [3, 4, 5, 6, 7];

export const DEFAULT_PREFS: TrainingPrefs = { place: 'home', minutes: 30, daysPerWeek: 4, level: 'beginner', limits: '' };

/** prompt 用描述 */
const PLACE_TEXT: Record<TrainingPlace, string> = {
  home: '在家训练，没有器械（徒手为主）',
  gym: '在健身房训练，器械齐全',
  outdoor: '户外训练（公园/操场，可快走、慢跑、跳绳）',
};
const LEVEL_TEXT: Record<TrainingLevel, string> = {
  beginner: '运动新手，体能一般',
  base: '有一定运动基础',
};

export function prefsText(p: TrainingPrefs): string {
  return [
    PLACE_TEXT[p.place],
    `每次最多 ${p.minutes} 分钟`,
    `每周训练 ${p.daysPerWeek} 天`,
    LEVEL_TEXT[p.level],
    `伤病/限制：${p.limits.trim() || '无'}`,
  ].join('；');
}

export function isPrefs(x: unknown): x is TrainingPrefs {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.place === 'string' &&
    o.place in PLACE_TEXT &&
    typeof o.level === 'string' &&
    o.level in LEVEL_TEXT &&
    (MINUTE_OPTIONS as unknown[]).includes(o.minutes) &&
    (DAY_OPTIONS as unknown[]).includes(o.daysPerWeek) &&
    typeof o.limits === 'string'
  );
}

export const isRestDay = (d: WorkoutDay) => d.focus.includes('休息') || /rest/i.test(d.focus);

export const dayBurn = (d: WorkoutDay) => d.exercises.reduce((s, e) => s + e.kcal, 0);
export const weekBurn = (p: WorkoutPlan) => p.days.reduce((s, d) => s + dayBurn(d), 0);

/** 当日已完成动作的消耗合计 */
export function burnedOn(log: WorkoutLog, date: string): number {
  return (log[date] ?? []).reduce((s, e) => s + e.kcal, 0);
}

const snap = (e: Exercise): DoneExercise => ({ id: e.id, name: e.name, kcal: e.kcal });

/** 勾选/取消一个动作；当天清空时删除日期键 */
export function toggleDone(log: WorkoutLog, date: string, ex: Exercise): WorkoutLog {
  const cur = log[date] ?? [];
  const next = cur.some((e) => e.id === ex.id) ? cur.filter((e) => e.id !== ex.id) : [...cur, snap(ex)];
  const out = { ...log };
  if (next.length) out[date] = next;
  else delete out[date];
  return out;
}

/** 一键完成：追加当天所有未勾选的动作 */
export function completeAll(log: WorkoutLog, date: string, exercises: Exercise[]): WorkoutLog {
  const cur = log[date] ?? [];
  const add = exercises.filter((e) => !cur.some((c) => c.id === e.id)).map(snap);
  if (add.length === 0) return log;
  return { ...log, [date]: [...cur, ...add] };
}

/** 按天替换；未涉及的天保持原引用 */
export function applyWorkoutChanges(plan: WorkoutPlan, changes: WorkoutChange[]): WorkoutPlan {
  if (changes.length === 0) return plan;
  const byDay = new Map(changes.map((c) => [c.weekday, c.next]));
  return { ...plan, days: plan.days.map((d) => byDay.get(d.weekday) ?? d) };
}

/** 净摄入 = 摄入 − 训练消耗，不低于 0 */
export const netIntake = (intake: number, burned: number) => Math.max(0, Math.round(intake - burned));

export const exerciseId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
