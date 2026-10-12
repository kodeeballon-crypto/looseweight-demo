import { describe, expect, it } from 'vitest';
import type { DailyRecord, Profile } from '../types';
import { calcStreak, newBadges, unlockedBadges } from './badges';

const rec = (date: string, weightKg = 100): DailyRecord => ({ date, weightKg, mealsEaten: [] });

const profile: Profile = {
  heightCm: 170,
  startWeightKg: 90, // BMI 31.1 肥胖
  targetWeightKg: 68,
  sex: 'female',
  age: 28,
  activity: 'light',
  startDate: '2026-09-01',
};

describe('连续打卡', () => {
  it('今天已打卡：从今天往前数', () => {
    expect(calcStreak([rec('2026-10-10'), rec('2026-10-11'), rec('2026-10-12')], '2026-10-12')).toBe(3);
  });
  it('今天未打卡：从昨天往前数', () => {
    expect(calcStreak([rec('2026-10-10'), rec('2026-10-11')], '2026-10-12')).toBe(2);
  });
  it('断签后重新计数', () => {
    expect(calcStreak([rec('2026-10-08'), rec('2026-10-09'), rec('2026-10-11'), rec('2026-10-12')], '2026-10-12')).toBe(2);
  });
  it('昨天和今天都没打卡为 0', () => {
    expect(calcStreak([rec('2026-10-09')], '2026-10-12')).toBe(0);
  });
  it('跨月份连续', () => {
    expect(calcStreak([rec('2026-09-30'), rec('2026-10-01')], '2026-10-01')).toBe(2);
  });
  it('无记录为 0', () => {
    expect(calcStreak([], '2026-10-12')).toBe(0);
  });
});

describe('里程碑徽章', () => {
  it('无记录无徽章', () => {
    expect(unlockedBadges(profile, [], '2026-10-12')).toEqual([]);
  });
  it('累计减重 1 / 3 kg', () => {
    const ids = unlockedBadges(profile, [rec('2026-10-12', 86.5)], '2026-10-12').map((b) => b.id);
    expect(ids).toContain('loss-1');
    expect(ids).toContain('loss-3');
    expect(ids).not.toContain('loss-5');
  });
  it('BMI 跨出肥胖区间、回归正常', () => {
    const ids1 = unlockedBadges(profile, [rec('2026-10-12', 80)], '2026-10-12').map((b) => b.id); // 27.7
    expect(ids1).toContain('bmi-over');
    expect(ids1).not.toContain('bmi-normal');
    const ids2 = unlockedBadges(profile, [rec('2026-10-12', 69)], '2026-10-12').map((b) => b.id); // 23.9
    expect(ids2).toContain('bmi-normal');
  });
  it('连续打卡 7 天', () => {
    const r = Array.from({ length: 7 }, (_, i) => rec(`2026-10-0${i + 1}`, 90));
    const ids = unlockedBadges(profile, r, '2026-10-07').map((b) => b.id);
    expect(ids).toContain('streak-7');
    expect(ids).not.toContain('streak-30');
  });
  it('newBadges 过滤已展示的', () => {
    const all = unlockedBadges(profile, [rec('2026-10-12', 86.5)], '2026-10-12');
    expect(newBadges(all, ['loss-1']).map((b) => b.id)).toEqual(['loss-3']);
  });
});
