export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active';

export interface Profile {
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  sex: Sex;
  age: number;
  activity: Activity;
  /** YYYY-MM-DD */
  startDate: string;
  /** 饮食偏好/忌口，传给 AI */
  preferences?: string;
}

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};
export const MEAL_EMOJI: Record<MealKey, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export interface DailyRecord {
  /** YYYY-MM-DD，唯一 */
  date: string;
  weightKg: number;
  mealsEaten: MealKey[];
  extraKcal?: number;
  encouragement?: string;
}

export interface Meal {
  name: string;
  items: string;
  kcal: number;
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export interface DayPlan {
  weekday: Weekday;
  meals: Record<MealKey, Meal>;
}

export interface WeekPlan {
  createdAt: string;
  dailyKcalTarget: number;
  days: DayPlan[];
  tips?: string[];
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  model: string;
  directMode: boolean;
}

export type KcalStatus = 'ok' | 'slight' | 'over';
