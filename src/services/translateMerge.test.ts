import { describe, expect, it } from 'vitest';
import type { Meal, NutritionAnalysis, WeekPlan, Weekday, WorkoutPlan } from '../types';
import {
  applyDayMealTranslation,
  applyNutritionTranslation,
  applyWeekPlanTranslation,
  applyWorkoutTranslation,
  weekPlanSource,
  workoutSource,
} from './translateMerge';

const m = (name: string, kcal = 400): Meal => ({ name, items: `${name}份量`, kcal });
const plan = (breakfast: string): WeekPlan => ({
  createdAt: 'same-created-at',
  dailyKcalTarget: 1800,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as Weekday,
    meals: { breakfast: m(breakfast), lunch: m('午饭'), dinner: m('晚饭'), snack: m('加餐') },
  })),
  tips: ['多喝水'],
});
const trData = (breakfastEn: string) => ({
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w,
    meals: {
      breakfast: { name: breakfastEn, items: `${breakfastEn} portion` },
      lunch: { name: 'Lunch', items: 'lunch portion' },
      dinner: { name: 'Dinner', items: 'dinner portion' },
      snack: { name: 'Snack', items: 'snack portion' },
    },
  })),
  tips: ['Drink water'],
});

describe('applyWeekPlanTranslation', () => {
  it('原文一致时写入英文', () => {
    const p = plan('鸡蛋');
    const next = applyWeekPlanTranslation(p, weekPlanSource(p), trData('Egg'));
    expect(next?.days[0].meals.breakfast.nameEn).toBe('Egg');
    expect(next?.tipsEn).toEqual(['Drink water']);
  });

  it('翻译期间早餐被改成“面条”（createdAt 相同）时，丢弃旧的 Egg', () => {
    const sent = plan('鸡蛋');
    const source = weekPlanSource(sent);
    const current = plan('面条');
    const next = applyWeekPlanTranslation(current, source, trData('Egg'));
    expect(next?.days[0].meals.breakfast.name).toBe('面条');
    expect(next?.days[0].meals.breakfast.nameEn).toBeUndefined();
    // 未变化的餐次照常写入
    expect(next?.days[0].meals.lunch.nameEn).toBe('Lunch');
  });

  it('翻译期间计划被清空时返回 null，不会“复活”旧计划', () => {
    const sent = plan('鸡蛋');
    expect(applyWeekPlanTranslation(null, weekPlanSource(sent), trData('Egg'))).toBeNull();
  });

  it('要点被修改后不写入旧的英文要点', () => {
    const sent = plan('鸡蛋');
    const current = { ...plan('鸡蛋'), tips: ['新的要点'] };
    expect(applyWeekPlanTranslation(current, weekPlanSource(sent), trData('Egg'))?.tipsEn).toBeUndefined();
  });
});

describe('applyDayMealTranslation', () => {
  it('只写入原文仍一致的餐次', () => {
    const current = plan('面条');
    const next = applyDayMealTranslation(current, 1, { breakfast: { name: '鸡蛋', items: '鸡蛋份量' } }, { breakfast: { nameEn: 'Egg', itemsEn: 'egg' } });
    expect(next).toBeNull();
  });
});

describe('applyWorkoutTranslation', () => {
  const wp = (name: string): WorkoutPlan => ({
    createdAt: 'w',
    days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w as Weekday, focus: '力量', exercises: [{ id: `e${w}`, name, detail: '3 组', kcal: 50 }] })),
  });
  const data = { days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, focus: 'Strength', exercises: [{ id: `e${w}`, name: 'Squat', detail: '3 sets' }] })) };

  it('动作被替换后不写入旧翻译', () => {
    const next = applyWorkoutTranslation(wp('平板支撑'), workoutSource(wp('深蹲')), data);
    expect(next?.days[0].exercises[0].nameEn).toBeUndefined();
    expect(next?.days[0].focusEn).toBe('Strength');
  });

  it('原文一致时写入', () => {
    const next = applyWorkoutTranslation(wp('深蹲'), workoutSource(wp('深蹲')), data);
    expect(next?.days[0].exercises[0].nameEn).toBe('Squat');
  });
});

describe('applyNutritionTranslation', () => {
  const a: NutritionAnalysis = { date: '2026-10-12', signature: 's1', meals: {}, summary: '蛋白偏高', suggestions: ['少吃'], at: '' };
  it('重新分析后（签名变化）丢弃旧翻译', () => {
    expect(applyNutritionTranslation({ ...a, signature: 's2' }, a, { summaryEn: 'High protein', suggestionsEn: ['Eat less'] })).toBeNull();
  });
  it('同一次分析时写入', () => {
    expect(applyNutritionTranslation(a, a, { summaryEn: 'High protein', suggestionsEn: ['Eat less'] })?.summaryEn).toBe('High protein');
  });
});

