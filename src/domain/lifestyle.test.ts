import { describe, expect, it } from 'vitest';
import { DEFAULT_LIFESTYLE } from '../types';
import type { Profile } from '../types';
import { isLifestyle, lifestyleOf, lifestyleText } from './lifestyle';

const base: Profile = {
  heightCm: 170,
  startWeightKg: 80,
  targetWeightKg: 70,
  sex: 'male',
  age: 30,
  activity: 'sedentary',
  startDate: '2026-10-01',
};

describe('lifestyleText', () => {
  it('默认生活节奏描述上班族、快手早餐、外卖午餐、15 分钟晚餐', () => {
    const t = lifestyleText(DEFAULT_LIFESTYLE);
    expect(t).toContain('上班族');
    expect(t).toContain('5 分钟');
    expect(t).toContain('外卖');
    expect(t).toContain('15 分钟');
  });
  it('晚餐 0 分钟描述为不做饭', () => {
    expect(lifestyleText({ ...DEFAULT_LIFESTYLE, dinnerMinutes: 0 })).toContain('不做饭');
  });
  it('早餐买现成、午餐带饭', () => {
    const t = lifestyleText({ routine: 'student', breakfast: 'buy', lunch: 'bento', dinnerMinutes: 60 });
    expect(t).toContain('学生');
    expect(t).toContain('买现成');
    expect(t).toContain('带饭');
    expect(t).toContain('不限');
  });
});

describe('lifestyleOf', () => {
  it('旧档案没有 lifestyle 时返回默认值', () => {
    expect(lifestyleOf(base)).toEqual(DEFAULT_LIFESTYLE);
  });
  it('有 lifestyle 时原样返回', () => {
    const l = { routine: 'home', breakfast: 'cook', lunch: 'cook', dinnerMinutes: 30 } as const;
    expect(lifestyleOf({ ...base, lifestyle: l })).toEqual(l);
  });
});

describe('isLifestyle', () => {
  it('接受合法值', () => {
    expect(isLifestyle(DEFAULT_LIFESTYLE)).toBe(true);
  });
  it('拒绝非法枚举或缺字段', () => {
    expect(isLifestyle({ ...DEFAULT_LIFESTYLE, routine: 'boss' })).toBe(false);
    expect(isLifestyle({ ...DEFAULT_LIFESTYLE, dinnerMinutes: 20 })).toBe(false);
    expect(isLifestyle({ routine: 'office' })).toBe(false);
    expect(isLifestyle(null)).toBe(false);
  });
});
