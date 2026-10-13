import type { DailyRecord, PlanChatMessage, Profile, Settings, WeekPlan } from '../types';
import { MEAL_KEYS } from '../types';
import { normalizeMeal } from '../ai/parse';
import { isLifestyle } from '../domain/lifestyle';
import { CHAT_MAX, MEMORY_MAX } from '../domain/planChat';

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
    planMemory: Array.isArray(o.planMemory)
      ? o.planMemory.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(-MEMORY_MAX)
      : [],
    planChat: toChat(o.planChat),
  };
}
