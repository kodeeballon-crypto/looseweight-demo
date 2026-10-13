import { describe, expect, it } from 'vitest';
import type { DailyRecord, Profile, WeekPlan, MealKey, Meal } from '../types';
import {
  bmiLevel,
  calcBmi,
  calcBmr,
  calcKcalTarget,
  calcTdee,
  computeStats,
  energyInfo,
  intakeOf,
  kcalStatus,
  movingAverage7,
  predictTargetDate,
  weekdayOf,
} from './calc';

const profile: Profile = {
  heightCm: 175,
  startWeightKg: 100,
  targetWeightKg: 80,
  sex: 'male',
  age: 30,
  activity: 'sedentary',
  startDate: '2026-10-01',
};

const rec = (date: string, weightKg: number, extra: Partial<DailyRecord> = {}): DailyRecord => ({
  date,
  weightKg,
  mealsEaten: [],
  ...extra,
});

const meal = (kcal: number): Meal => ({ name: 'x', items: 'y', kcal });
const plan: WeekPlan = {
  createdAt: '',
  dailyKcalTarget: 1800,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as 1,
    meals: { breakfast: meal(400), lunch: meal(600), dinner: meal(500), snack: meal(150) } as Record<MealKey, Meal>,
  })),
};

describe('BMI', () => {
  it('计算 BMI', () => {
    expect(calcBmi(100, 175)).toBeCloseTo(32.65, 2);
  });
  it('按中国标准分级（边界）', () => {
    expect(bmiLevel(18.4).key).toBe('under');
    expect(bmiLevel(18.5).key).toBe('normal');
    expect(bmiLevel(23.9).key).toBe('normal');
    expect(bmiLevel(24).key).toBe('over');
    expect(bmiLevel(27.9).key).toBe('over');
    expect(bmiLevel(28).key).toBe('obese');
  });
});

describe('BMR / TDEE / 目标', () => {
  it('Mifflin-St Jeor 男女公式', () => {
    expect(calcBmr('male', 100, 175, 30)).toBeCloseTo(1000 + 1093.75 - 150 + 5);
    expect(calcBmr('female', 70, 160, 30)).toBeCloseTo(700 + 1000 - 150 - 161);
  });
  it('TDEE = BMR × 活动系数', () => {
    expect(calcTdee(1000, 'moderate')).toBeCloseTo(1550);
  });
  it('热量目标 = TDEE - 500，且不低于安全下限', () => {
    expect(calcKcalTarget(2500, 'male')).toBe(2000);
    expect(calcKcalTarget(1800, 'male')).toBe(1500);
    expect(calcKcalTarget(1500, 'female')).toBe(1200);
  });
  it('energyInfo 使用最新一次记录体重', () => {
    const info = energyInfo(profile, [rec('2026-10-02', 99), rec('2026-10-05', 95)]);
    expect(info.weightKg).toBe(95);
    expect(info.bmr).toBe(Math.round(calcBmr('male', 95, 175, 30)));
  });
});

describe('摄入与状态', () => {
  it('weekdayOf 周一=1、周日=7', () => {
    expect(weekdayOf('2026-10-12')).toBe(1); // 周一
    expect(weekdayOf('2026-10-18')).toBe(7); // 周日
  });
  it('摄入 = 勾选餐次 kcal + 计划外', () => {
    expect(intakeOf({ date: '2026-10-12', mealsEaten: ['breakfast', 'lunch'], extraKcal: 300 }, plan)).toEqual({
      kcal: 1300,
      hasPlan: true,
    });
  });
  it('无计划时只统计计划外', () => {
    expect(intakeOf({ date: '2026-10-12', mealsEaten: ['breakfast'], extraKcal: 200 }, null)).toEqual({
      kcal: 200,
      hasPlan: false,
    });
  });
  it('热量状态边界', () => {
    expect(kcalStatus(1800, 1800)).toBe('ok');
    expect(kcalStatus(1980, 1800)).toBe('slight');
    expect(kcalStatus(1981, 1800)).toBe('over');
  });
});

describe('7 日均线', () => {
  it('取该日及之前 6 天内的记录平均', () => {
    const r = [rec('2026-10-01', 100), rec('2026-10-04', 98), rec('2026-10-07', 96), rec('2026-10-08', 95)];
    const avg = movingAverage7(r);
    expect(avg.map((a) => a.avg)).toEqual([100, 99, 98, (98 + 96 + 95) / 3].map((n) => Math.round(n * 100) / 100));
  });
  it('乱序输入也按日期排序', () => {
    const avg = movingAverage7([rec('2026-10-02', 90), rec('2026-10-01', 100)]);
    expect(avg[0]).toEqual({ date: '2026-10-01', avg: 100 });
    expect(avg[1]).toEqual({ date: '2026-10-02', avg: 95 });
  });
});

describe('统计', () => {
  it('累计减重、进度、近 7 天、平均周减重', () => {
    const r = [rec('2026-10-01', 100), rec('2026-10-08', 98), rec('2026-10-15', 95)];
    const s = computeStats(profile, r, null, 1800);
    expect(s.totalLoss).toBe(5);
    expect(s.progress).toBeCloseTo(0.25);
    expect(s.change7d).toBe(-3);
    expect(s.weeklyLoss).toBe(2.5);
  });
  it('进度截断到 0–100%', () => {
    expect(computeStats(profile, [rec('2026-10-02', 105)], null, 1800).progress).toBe(0);
    expect(computeStats(profile, [rec('2026-10-02', 70)], null, 1800).progress).toBe(1);
  });
  it('热量达标率只统计填写了饮食的天数', () => {
    const r = [
      rec('2026-10-12', 99, { mealsEaten: ['breakfast', 'lunch', 'dinner'] }), // 1500 ok
      rec('2026-10-13', 98, { mealsEaten: ['breakfast', 'lunch', 'dinner'], extraKcal: 600 }), // 2100 over
      rec('2026-10-14', 98),
    ];
    const s = computeStats(profile, r, plan, 1800);
    expect(s.kcalDays).toBe(2);
    expect(s.kcalOkRate).toBe(0.5);
  });
  it('传入训练记录后按净摄入判定达标', () => {
    const r = [rec('2026-10-13', 98, { mealsEaten: ['breakfast', 'lunch', 'dinner'], extraKcal: 600 })]; // 2100
    expect(computeStats(profile, r, plan, 1800).kcalOkRate).toBe(0);
    const log = { '2026-10-13': [{ id: 'a', name: '快走', kcal: 300 }] }; // 净 1800
    expect(computeStats(profile, r, plan, 1800, log).kcalOkRate).toBe(1);
  });
  it('无记录时安全返回', () => {
    const s = computeStats(profile, [], null, 1800);
    expect(s.totalLoss).toBe(0);
    expect(s.change7d).toBeNull();
    expect(s.kcalOkRate).toBeNull();
  });
});

describe('预计达成日期', () => {
  it('按近 4 周平均速度线性外推', () => {
    const r = [rec('2026-10-01', 100), rec('2026-10-11', 98)]; // 0.2 kg/天
    expect(predictTargetDate(profile, r)).toEqual({ kind: 'date', date: '2027-01-09', daysLeft: 90 });
  });
  it('速度 ≤0 时继续加油', () => {
    expect(predictTargetDate(profile, [rec('2026-10-01', 100), rec('2026-10-05', 101)]).kind).toBe('keepGoing');
    expect(predictTargetDate(profile, [rec('2026-10-01', 100)]).kind).toBe('keepGoing');
  });
  it('已达成', () => {
    expect(predictTargetDate(profile, [rec('2026-10-01', 79)]).kind).toBe('reached');
  });
  it('只使用近 28 天的数据', () => {
    const r = [rec('2026-08-01', 120), rec('2026-10-01', 100), rec('2026-10-11', 98)];
    expect(predictTargetDate(profile, r)).toMatchObject({ kind: 'date', daysLeft: 90 });
  });
});
