export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active';

/** 生活节奏：决定 AI 食谱的备餐难度 */
export type Routine = 'office' | 'student' | 'home' | 'shift';
export type BreakfastMode = 'buy' | 'quick' | 'cook'; // 买现成 / 5 分钟快手 / 能做饭
export type LunchMode = 'takeout' | 'canteen' | 'bento' | 'cook'; // 外卖 / 食堂 / 带饭 / 自己做
export type DinnerMinutes = 0 | 15 | 30 | 60; // 0=不做饭，60=不限

export interface Lifestyle {
  routine: Routine;
  breakfast: BreakfastMode;
  lunch: LunchMode;
  dinnerMinutes: DinnerMinutes;
}

export const DEFAULT_LIFESTYLE: Lifestyle = { routine: 'office', breakfast: 'quick', lunch: 'takeout', dinnerMinutes: 15 };

export interface Profile {
  /** 生活节奏（旧数据可能没有，使用 DEFAULT_LIFESTYLE） */
  lifestyle?: Lifestyle;
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

/** 饮食周表 AI 对话消息 */
export interface PlanChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** ISO 时间 */
  at: string;
  /** assistant 消息附带的改动数（仅展示用） */
  changeCount?: number;
  /** 该条方案是否已应用 */
  applied?: boolean;
}

/** 对某一格的修改 */
export interface MealChange {
  weekday: Weekday;
  meal: MealKey;
  next: Meal;
}

/** AI 对话返回的调整方案 */
export interface PlanAdjustment {
  reply: string;
  changes: MealChange[];
  memoryAdd: string[];
  memoryRemove: string[];
}

// ---------- 训练 ----------

export type TrainingPlace = 'home' | 'gym' | 'outdoor';
export type TrainingLevel = 'beginner' | 'base';
export type TrainingMinutes = 20 | 30 | 45 | 60;
export type TrainingDays = 3 | 4 | 5 | 6 | 7;

/** 训练条件：生成训练周表前填写 */
export interface TrainingPrefs {
  place: TrainingPlace;
  minutes: TrainingMinutes;
  daysPerWeek: TrainingDays;
  level: TrainingLevel;
  /** 伤病/不能做的动作，可为空 */
  limits: string;
}

export interface Exercise {
  /** 客户端生成，用于勾选 */
  id: string;
  name: string;
  /** 组数×次数或时长 + 要点 */
  detail: string;
  kcal: number;
}

export interface WorkoutDay {
  weekday: Weekday;
  /** 训练重点，如“下肢力量”“休息·拉伸” */
  focus: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  createdAt: string;
  days: WorkoutDay[];
  tips?: string[];
}

/** 已完成动作快照：勾选时记录，之后改周表不影响历史 */
export interface DoneExercise {
  id: string;
  name: string;
  kcal: number;
}

/** 日期(YYYY-MM-DD) → 当天已完成的动作 */
export type WorkoutLog = Record<string, DoneExercise[]>;

/** 训练对话的修改以“整天”为粒度 */
export interface WorkoutChange {
  weekday: Weekday;
  next: WorkoutDay;
}

export interface WorkoutAdjustment {
  reply: string;
  changes: WorkoutChange[];
  memoryAdd: string[];
  memoryRemove: string[];
}

// ---------- 营养结构 ----------

export type MacroKind = 'protein' | 'carbs' | 'fat';

/** 三大营养素克数 */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/** 某天的 AI 营养分析结果（按日期缓存） */
export interface NutritionAnalysis {
  /** YYYY-MM-DD */
  date: string;
  /** 分析时的餐食签名，变化即视为过期 */
  signature: string;
  meals: Partial<Record<MealKey, Macros>>;
  summary: string;
  suggestions: string[];
  /** ISO 时间 */
  at: string;
}

export type NutritionCache = Record<string, NutritionAnalysis>;
