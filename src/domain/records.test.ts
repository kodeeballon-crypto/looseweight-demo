import { describe, expect, it } from 'vitest';
import type { DailyRecord, Meal, WeekPlan, Weekday } from '../types';
import { computeStats, intakeOf } from './calc';
import { freezeRecord, freezeRecords, snapshotMeals } from './records';
import { todayMeals } from './nutrition';

const m = (name: string, kcal: number): Meal => ({ name, items: `${name}份量`, kcal });
const planWith = (breakfastKcal: number, name = '鸡蛋'): WeekPlan => ({
  createdAt: `plan-${breakfastKcal}`,
  dailyKcalTarget: 1800,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as Weekday,
    meals: { breakfast: m(name, breakfastKcal), lunch: m('午饭', 600), dinner: m('晚饭', 500), snack: m('加餐', 100) },
  })),
});

// 2026-10-12 是周一
const D = '2026-10-12';
const rec = (patch: Partial<DailyRecord> = {}): DailyRecord => ({ date: D, weightKg: 80, mealsEaten: ['breakfast'], ...patch });

describe('snapshotMeals', () => {
  it('只为已吃的餐生成快照，并完整复制当天计划', () => {
    const snap = snapshotMeals(['breakfast'], D, planWith(400));
    expect(snap).toEqual({ breakfast: m('鸡蛋', 400) });
  });

  it('优先沿用已有快照，缺失的才从计划补齐', () => {
    const snap = snapshotMeals(['breakfast', 'lunch'], D, planWith(900, '面条'), { breakfast: m('鸡蛋', 400) });
    expect(snap?.breakfast).toEqual(m('鸡蛋', 400));
    expect(snap?.lunch?.kcal).toBe(600);
  });

  it('没有计划也没有快照时返回 undefined', () => {
    expect(snapshotMeals(['breakfast'], D, null)).toBeUndefined();
    expect(snapshotMeals([], D, planWith(400))).toBeUndefined();
  });
});

describe('历史热量不随食谱变化', () => {
  it('打卡冻结 400 kcal 早餐后，换成 900 kcal 计划仍读到 400', () => {
    const frozen = freezeRecord(rec(), planWith(400));
    const newPlan = planWith(900, '面条');
    expect(intakeOf(frozen, newPlan).kcal).toBe(400);
    // 达标率同样按快照计算
    expect(computeStats({ heightCm: 170, startWeightKg: 80, targetWeightKg: 70, sex: 'male', age: 30, activity: 'sedentary', startDate: D }, [frozen], newPlan, 450).kcalOkRate).toBe(1);
  });

  it('没有快照的实时预览仍按当前计划计算', () => {
    expect(intakeOf(rec(), planWith(900)).kcal).toBe(900);
  });

  it('快照存在时即便计划被清空也能计算', () => {
    const frozen = freezeRecord(rec(), planWith(400));
    expect(intakeOf(frozen, null)).toEqual({ kcal: 400, hasPlan: true });
  });

  it('营养分析使用当天打卡时的快照', () => {
    const frozen = freezeRecord(rec(), planWith(400));
    expect(todayMeals(planWith(900, '面条'), frozen, 1).meals.breakfast?.name).toBe('鸡蛋');
  });
});

describe('freezeRecords', () => {
  it('只补齐缺失的快照，不覆盖已有快照，取消勾选的餐被移除', () => {
    const old = rec({ mealsEaten: ['breakfast'], mealSnapshot: { breakfast: m('鸡蛋', 400), lunch: m('旧午饭', 700) } });
    const fresh = rec({ date: '2026-10-13', mealsEaten: ['lunch'] });
    const [a, b] = freezeRecords([old, fresh], planWith(900, '面条'));
    expect(a.mealSnapshot).toEqual({ breakfast: m('鸡蛋', 400) });
    expect(b.mealSnapshot).toEqual({ lunch: m('午饭', 600) });
  });

  it('计划为空且无快照时保持原样', () => {
    const r = rec();
    expect(freezeRecords([r], null)[0]).toEqual(r);
  });
});

