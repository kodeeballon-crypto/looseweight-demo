import type { BreakfastMode, DinnerMinutes, Lifestyle, LunchMode, Profile, Routine } from '../types';
import { DEFAULT_LIFESTYLE } from '../types';

/** UI 选项文案 */
export const ROUTINE_LABELS: Record<Routine, string> = {
  office: '💼 上班族',
  student: '🎓 学生',
  home: '🏠 居家',
  shift: '🌙 倒班',
};
export const BREAKFAST_LABELS: Record<BreakfastMode, string> = {
  buy: '🏪 买现成',
  quick: '⚡ 5 分钟快手',
  cook: '🍳 能做饭',
};
export const LUNCH_LABELS: Record<LunchMode, string> = {
  takeout: '🛵 外卖',
  canteen: '🍱 食堂',
  bento: '🥡 带饭',
  cook: '👩‍🍳 自己做',
};
export const DINNER_OPTIONS: DinnerMinutes[] = [0, 15, 30, 60];
export const DINNER_LABELS: Record<DinnerMinutes, string> = {
  0: '不做饭',
  15: '15 分钟',
  30: '30 分钟',
  60: '不限',
};

/** prompt 用描述 */
const ROUTINE_TEXT: Record<Routine, string> = {
  office: '上班族（工作日朝九晚六通勤，时间紧）',
  student: '学生（课程安排紧，主要在学校吃）',
  home: '居家（时间相对充裕）',
  shift: '倒班（作息不规律，用餐时间不固定）',
};
const BREAKFAST_TEXT: Record<BreakfastMode, string> = {
  buy: '工作日早餐不做，买现成的（便利店/早餐铺/面包店）',
  quick: '工作日早餐只能 5 分钟快手搞定（冲泡、加热、即食为主）',
  cook: '早餐可以自己做',
};
const LUNCH_TEXT: Record<LunchMode, string> = {
  takeout: '工作日午餐点外卖',
  canteen: '工作日午餐吃食堂',
  bento: '工作日午餐带饭（前一晚准备，需适合加热）',
  cook: '午餐可以自己做',
};
const DINNER_TEXT: Record<DinnerMinutes, string> = {
  0: '晚餐不做饭（外卖/外食/现成食品）',
  15: '晚餐最多花 15 分钟做快手菜',
  30: '晚餐最多花 30 分钟做饭',
  60: '晚餐做饭时间不限',
};

export function lifestyleOf(p: Profile): Lifestyle {
  return p.lifestyle ?? DEFAULT_LIFESTYLE;
}

export function lifestyleText(l: Lifestyle): string {
  return [ROUTINE_TEXT[l.routine], BREAKFAST_TEXT[l.breakfast], LUNCH_TEXT[l.lunch], DINNER_TEXT[l.dinnerMinutes]].join('；');
}

export function isLifestyle(x: unknown): x is Lifestyle {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.routine === 'string' &&
    o.routine in ROUTINE_TEXT &&
    typeof o.breakfast === 'string' &&
    o.breakfast in BREAKFAST_TEXT &&
    typeof o.lunch === 'string' &&
    o.lunch in LUNCH_TEXT &&
    typeof o.dinnerMinutes === 'number' &&
    (DINNER_OPTIONS as number[]).includes(o.dinnerMinutes)
  );
}
