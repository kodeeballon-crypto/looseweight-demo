import dayjs from 'dayjs';
import type { DailyRecord, Profile } from '../types';
import { bmiLevel, calcBmi, latestWeight } from './calc';

/** 连续打卡：从今天（或昨天，若今天未打卡）往前数连续有记录的天数 */
export function calcStreak(records: DailyRecord[], today: string): number {
  const dates = new Set(records.map((r) => r.date));
  let cursor = dayjs(today);
  if (!dates.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day');
  let n = 0;
  while (dates.has(cursor.format('YYYY-MM-DD'))) {
    n++;
    cursor = cursor.subtract(1, 'day');
  }
  return n;
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
}

const LOSS_STEPS = [1, 3, 5, 10, 15, 20];
const STREAK_STEPS = [7, 30, 100];

const LOSS_EMOJI: Record<number, string> = { 1: '🌱', 3: '🌿', 5: '🌳', 10: '🏅', 15: '🏆', 20: '👑' };
const STREAK_EMOJI: Record<number, string> = { 7: '🔥', 30: '💎', 100: '🚀' };

export const BMI_BADGES: Record<string, Badge> = {
  'bmi-over': { id: 'bmi-over', emoji: '🎉', title: '告别肥胖区间', desc: 'BMI 降到 28 以下，进入超重区间' },
  'bmi-normal': { id: 'bmi-normal', emoji: '✨', title: 'BMI 回归正常', desc: 'BMI 降到 24 以下，健康体重达成' },
};

/** 所有可能的徽章定义（用于展示徽章墙） */
export function allBadges(): Badge[] {
  return [
    ...LOSS_STEPS.map((kg) => lossBadge(kg)),
    ...STREAK_STEPS.map((d) => streakBadge(d)),
    BMI_BADGES['bmi-over'],
    BMI_BADGES['bmi-normal'],
  ];
}

function lossBadge(kg: number): Badge {
  return { id: `loss-${kg}`, emoji: LOSS_EMOJI[kg], title: `累计减重 ${kg} kg`, desc: `已经比开始时轻了 ${kg} 公斤` };
}

function streakBadge(d: number): Badge {
  return { id: `streak-${d}`, emoji: STREAK_EMOJI[d], title: `连续打卡 ${d} 天`, desc: `坚持了整整 ${d} 天，习惯正在养成` };
}

/** 根据当前数据计算已解锁的全部徽章 */
export function unlockedBadges(profile: Profile, records: DailyRecord[], today: string): Badge[] {
  const result: Badge[] = [];
  if (records.length === 0) return result;

  const loss = profile.startWeightKg - latestWeight(profile, records);
  for (const kg of LOSS_STEPS) if (loss >= kg - 1e-9) result.push(lossBadge(kg));

  const streak = calcStreak(records, today);
  for (const d of STREAK_STEPS) if (streak >= d) result.push(streakBadge(d));

  const startRank = bmiLevel(calcBmi(profile.startWeightKg, profile.heightCm)).rank;
  const nowRank = bmiLevel(calcBmi(latestWeight(profile, records), profile.heightCm)).rank;
  if (startRank >= 3 && nowRank <= 2) result.push(BMI_BADGES['bmi-over']);
  if (startRank >= 2 && nowRank <= 1) result.push(BMI_BADGES['bmi-normal']);

  return result;
}

/** 新解锁（尚未展示过）的徽章 */
export function newBadges(unlocked: Badge[], seen: string[]): Badge[] {
  const s = new Set(seen);
  return unlocked.filter((b) => !s.has(b.id));
}
