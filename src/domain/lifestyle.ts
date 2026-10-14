import type { BreakfastMode, DinnerMinutes, Lifestyle, LunchMode, Profile, Routine } from '../types';
import { DEFAULT_LIFESTYLE } from '../types';
import type { Lang } from '../i18n/types';

/** UI 选项文案 */
export const ROUTINE_LABELS_MAP: Record<Lang, Record<Routine, string>> = {
  zh: {
    office: '💼 上班族',
    student: '🎓 学生',
    home: '🏠 居家',
    shift: '🌙 倒班',
  },
  en: {
    office: '💼 Office Worker',
    student: '🎓 Student',
    home: '🏠 Work from Home',
    shift: '🌙 Shift Worker',
  },
};
export const ROUTINE_LABELS = ROUTINE_LABELS_MAP.zh;

export const BREAKFAST_LABELS_MAP: Record<Lang, Record<BreakfastMode, string>> = {
  zh: {
    buy: '🏪 买现成',
    quick: '⚡ 5 分钟快手',
    cook: '🍳 能做饭',
  },
  en: {
    buy: '🏪 Ready-made',
    quick: '⚡ 5-min Quick',
    cook: '🍳 Can Cook',
  },
};
export const BREAKFAST_LABELS = BREAKFAST_LABELS_MAP.zh;

export const LUNCH_LABELS_MAP: Record<Lang, Record<LunchMode, string>> = {
  zh: {
    takeout: '🛵 外卖',
    canteen: '🍱 食堂',
    bento: '🥡 带饭',
    cook: '👩‍🍳 自己做',
  },
  en: {
    takeout: '🛵 Takeout',
    canteen: '🍱 Canteen',
    bento: '🥡 Meal Prep',
    cook: '👩‍🍳 Cook Myself',
  },
};
export const LUNCH_LABELS = LUNCH_LABELS_MAP.zh;

export const DINNER_OPTIONS: DinnerMinutes[] = [0, 15, 30, 60];
export const DINNER_LABELS_MAP: Record<Lang, Record<DinnerMinutes, string>> = {
  zh: {
    0: '不做饭',
    15: '15 分钟',
    30: '30 分钟',
    60: '不限',
  },
  en: {
    0: 'No Cooking',
    15: '15 mins',
    30: '30 mins',
    60: 'Unlimited',
  },
};
export const DINNER_LABELS = DINNER_LABELS_MAP.zh;

/** prompt 用描述 */
const ROUTINE_TEXT_ZH: Record<Routine, string> = {
  office: '上班族（工作日朝九晚六通勤，时间紧）',
  student: '学生（课程安排紧，主要在学校吃）',
  home: '居家（时间相对充裕）',
  shift: '倒班（作息不规律，用餐时间不固定）',
};
const BREAKFAST_TEXT_ZH: Record<BreakfastMode, string> = {
  buy: '工作日早餐不做，买现成的（便利店/早餐铺/面包店）',
  quick: '工作日早餐只能 5 分钟快手搞定（冲泡、加热、即食为主）',
  cook: '早餐可以自己做',
};
const LUNCH_TEXT_ZH: Record<LunchMode, string> = {
  takeout: '工作日午餐点外卖',
  canteen: '工作日午餐吃食堂',
  bento: '工作日午餐带饭（前一晚准备，需适合加热）',
  cook: '午餐可以自己做',
};
const DINNER_TEXT_ZH: Record<DinnerMinutes, string> = {
  0: '晚餐不做饭（外卖/外食/现成食品）',
  15: '晚餐最多花 15 分钟做快手菜',
  30: '晚餐最多花 30 分钟做饭',
  60: '晚餐做饭时间不限',
};

const ROUTINE_TEXT_EN: Record<Routine, string> = {
  office: 'Office worker (9-to-6 commute on weekdays, tight schedule)',
  student: 'Student (busy coursework, mostly dining on campus)',
  home: 'Work from home (flexible time)',
  shift: 'Shift worker (irregular sleep & eating schedule)',
};
const BREAKFAST_TEXT_EN: Record<BreakfastMode, string> = {
  buy: 'Weekday breakfast: buy ready-made (convenience store, bakery, bakery shop)',
  quick: 'Weekday breakfast: 5-minute quick prep (instant oatmeal, boiled eggs, reheating)',
  cook: 'Breakfast: can cook from scratch',
};
const LUNCH_TEXT_EN: Record<LunchMode, string> = {
  takeout: 'Weekday lunch: order takeout',
  canteen: 'Weekday lunch: cafeteria / canteen',
  bento: 'Weekday lunch: meal prep / lunchbox from the night before',
  cook: 'Lunch: can cook at home',
};
const DINNER_TEXT_EN: Record<DinnerMinutes, string> = {
  0: 'Dinner: no cooking (takeout / ready-to-eat)',
  15: 'Dinner: quick meals within 15 minutes',
  30: 'Dinner: up to 30 minutes cooking time',
  60: 'Dinner: unlimited cooking time',
};

export function lifestyleOf(p: Profile): Lifestyle {
  return p.lifestyle ?? DEFAULT_LIFESTYLE;
}

export function lifestyleText(l: Lifestyle, lang: Lang = 'zh'): string {
  if (lang === 'en') {
    return [ROUTINE_TEXT_EN[l.routine], BREAKFAST_TEXT_EN[l.breakfast], LUNCH_TEXT_EN[l.lunch], DINNER_TEXT_EN[l.dinnerMinutes]].join('; ');
  }
  return [ROUTINE_TEXT_ZH[l.routine], BREAKFAST_TEXT_ZH[l.breakfast], LUNCH_TEXT_ZH[l.lunch], DINNER_TEXT_ZH[l.dinnerMinutes]].join('；');
}

export function isLifestyle(x: unknown): x is Lifestyle {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.routine === 'string' &&
    o.routine in ROUTINE_TEXT_ZH &&
    typeof o.breakfast === 'string' &&
    o.breakfast in BREAKFAST_TEXT_ZH &&
    typeof o.lunch === 'string' &&
    o.lunch in LUNCH_TEXT_ZH &&
    typeof o.dinnerMinutes === 'number' &&
    (DINNER_OPTIONS as number[]).includes(o.dinnerMinutes)
  );
}
