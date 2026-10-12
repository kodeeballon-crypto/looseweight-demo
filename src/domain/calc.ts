import dayjs from 'dayjs';
import type { Activity, DailyRecord, KcalStatus, Profile, Sex, WeekPlan, Weekday } from '../types';

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: '久坐（几乎不运动）',
  light: '轻度（每周 1–3 次）',
  moderate: '中度（每周 3–5 次）',
  active: '高强度（每周 6–7 次）',
};

export const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

export const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------- BMI ----------

export type BmiLevelKey = 'under' | 'normal' | 'over' | 'obese';
export interface BmiLevel {
  key: BmiLevelKey;
  label: string;
  /** 0 偏瘦 / 1 正常 / 2 超重 / 3 肥胖 */
  rank: number;
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** 中国标准：<18.5 偏瘦，18.5–23.9 正常，24–27.9 超重，≥28 肥胖 */
export function bmiLevel(bmi: number): BmiLevel {
  if (bmi < 18.5) return { key: 'under', label: '偏瘦', rank: 0 };
  if (bmi < 24) return { key: 'normal', label: '正常', rank: 1 };
  if (bmi < 28) return { key: 'over', label: '超重', rank: 2 };
  return { key: 'obese', label: '肥胖', rank: 3 };
}

// ---------- 能量 ----------

/** Mifflin-St Jeor */
export function calcBmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calcTdee(bmr: number, activity: Activity): number {
  return bmr * ACTIVITY_FACTOR[activity];
}

export function calcKcalTarget(tdee: number, sex: Sex): number {
  return Math.round(Math.max(tdee - 500, KCAL_FLOOR[sex]));
}

export interface EnergyInfo {
  weightKg: number;
  bmi: number;
  bmr: number;
  tdee: number;
  target: number;
}

/** 以最新体重计算全部能量指标 */
export function energyInfo(profile: Profile, records: DailyRecord[]): EnergyInfo {
  const weightKg = latestWeight(profile, records);
  const bmr = calcBmr(profile.sex, weightKg, profile.heightCm, profile.age);
  const tdee = calcTdee(bmr, profile.activity);
  return {
    weightKg,
    bmi: calcBmi(weightKg, profile.heightCm),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: calcKcalTarget(tdee, profile.sex),
  };
}

// ---------- 记录 ----------

export function sortRecords(records: DailyRecord[]): DailyRecord[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestRecord(records: DailyRecord[]): DailyRecord | undefined {
  return sortRecords(records).at(-1);
}

export function latestWeight(profile: Profile, records: DailyRecord[]): number {
  return latestRecord(records)?.weightKg ?? profile.startWeightKg;
}

/** 日期 → 周几（周一=1 … 周日=7） */
export function weekdayOf(date: string): Weekday {
  const d = dayjs(date).day(); // 0 = 周日
  return (d === 0 ? 7 : d) as Weekday;
}

export interface Intake {
  kcal: number;
  /** 当天是否有对应的周计划 */
  hasPlan: boolean;
}

/** 当日摄入 = Σ(当天周计划中被勾选餐次的 kcal) + extraKcal */
export function intakeOf(record: Pick<DailyRecord, 'date' | 'mealsEaten' | 'extraKcal'>, plan: WeekPlan | null): Intake {
  const extra = record.extraKcal && record.extraKcal > 0 ? record.extraKcal : 0;
  const day = plan?.days.find((d) => d.weekday === weekdayOf(record.date));
  if (!day) return { kcal: extra, hasPlan: false };
  const planned = record.mealsEaten.reduce((sum, k) => sum + (day.meals[k]?.kcal ?? 0), 0);
  return { kcal: Math.round(planned + extra), hasPlan: true };
}

/** 当天是否填写了任何饮食信息（用于达标率统计） */
export function hasIntakeData(record: DailyRecord): boolean {
  return record.mealsEaten.length > 0 || (record.extraKcal ?? 0) > 0;
}

export function kcalStatus(intake: number, target: number): KcalStatus {
  if (intake <= target) return 'ok';
  if (intake <= target * 1.1) return 'slight';
  return 'over';
}

export const KCAL_STATUS_LABEL: Record<KcalStatus, string> = {
  ok: '达标',
  slight: '略超',
  over: '超标',
};

// ---------- 均线 ----------

export interface AvgPoint {
  date: string;
  avg: number;
}

/** 每个有记录的日期，取该日及之前 6 天内所有记录的平均值 */
export function movingAverage7(records: DailyRecord[]): AvgPoint[] {
  const sorted = sortRecords(records);
  return sorted.map((r) => {
    const from = dayjs(r.date).subtract(6, 'day').format('YYYY-MM-DD');
    const win = sorted.filter((x) => x.date >= from && x.date <= r.date);
    const avg = win.reduce((s, x) => s + x.weightKg, 0) / win.length;
    return { date: r.date, avg: Math.round(avg * 100) / 100 };
  });
}

// ---------- 统计 ----------

export interface Stats {
  startWeight: number;
  latestWeight: number;
  /** 累计减重（正数为减少） */
  totalLoss: number;
  /** 0–1 */
  progress: number;
  /** 近 7 天变化（负数为下降），数据不足为 null */
  change7d: number | null;
  /** 平均每周减重（正数为减少），数据不足为 null */
  weeklyLoss: number | null;
  /** 热量达标率 0–1，无饮食数据为 null */
  kcalOkRate: number | null;
  kcalDays: number;
}

export function computeStats(profile: Profile, records: DailyRecord[], plan: WeekPlan | null, target: number): Stats {
  const sorted = sortRecords(records);
  const latest = sorted.at(-1);
  const startWeight = profile.startWeightKg;
  const latestW = latest?.weightKg ?? startWeight;
  const totalLoss = round1(startWeight - latestW);
  const need = startWeight - profile.targetWeightKg;
  const progress = need > 0 ? Math.min(1, Math.max(0, (startWeight - latestW) / need)) : latestW <= profile.targetWeightKg ? 1 : 0;

  let change7d: number | null = null;
  let weeklyLoss: number | null = null;
  if (latest) {
    const from = dayjs(latest.date).subtract(7, 'day').format('YYYY-MM-DD');
    const win = sorted.filter((r) => r.date >= from);
    if (win.length >= 2) change7d = round1(latest.weightKg - win[0].weightKg);

    const days = dayjs(latest.date).diff(dayjs(profile.startDate), 'day');
    if (days >= 1) weeklyLoss = round1(((startWeight - latestW) / days) * 7);
  }

  const withIntake = sorted.filter(hasIntakeData);
  const okDays = withIntake.filter((r) => kcalStatus(intakeOf(r, plan).kcal, target) === 'ok').length;

  return {
    startWeight,
    latestWeight: latestW,
    totalLoss,
    progress,
    change7d,
    weeklyLoss,
    kcalOkRate: withIntake.length ? okDays / withIntake.length : null,
    kcalDays: withIntake.length,
  };
}

export type Prediction =
  | { kind: 'reached' }
  | { kind: 'date'; date: string; daysLeft: number }
  | { kind: 'keepGoing' };

/** 按近 4 周平均速度线性外推目标达成日期；速度 ≤0 或数据不足时“继续加油” */
export function predictTargetDate(profile: Profile, records: DailyRecord[]): Prediction {
  const sorted = sortRecords(records);
  const latest = sorted.at(-1);
  if (!latest) return { kind: 'keepGoing' };
  if (latest.weightKg <= profile.targetWeightKg) return { kind: 'reached' };

  const from = dayjs(latest.date).subtract(28, 'day').format('YYYY-MM-DD');
  const win = sorted.filter((r) => r.date >= from);
  const first = win[0];
  const span = dayjs(latest.date).diff(dayjs(first.date), 'day');
  if (span < 1) return { kind: 'keepGoing' };
  const speed = (first.weightKg - latest.weightKg) / span; // kg/天
  if (speed <= 0) return { kind: 'keepGoing' };

  const daysLeft = Math.max(1, Math.ceil((latest.weightKg - profile.targetWeightKg) / speed - 1e-9));
  return { kind: 'date', date: dayjs(latest.date).add(daysLeft, 'day').format('YYYY-MM-DD'), daysLeft };
}
