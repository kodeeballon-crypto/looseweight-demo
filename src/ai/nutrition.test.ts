import { describe, expect, it } from 'vitest';
import type { Meal, MealKey, Profile } from '../types';
import { nutritionMessages } from './nutritionPrompts';
import { parseNutrition } from './parseNutrition';
import { ParseError } from './parse';

const profile: Profile = {
  heightCm: 165,
  startWeightKg: 65,
  targetWeightKg: 55,
  sex: 'female',
  age: 28,
  activity: 'light',
  startDate: '2026-10-01',
};
const meals: Partial<Record<MealKey, Meal>> = {
  breakfast: { name: '全麦鸡蛋三明治', items: '全麦面包2片、水煮蛋1个', kcal: 380 },
  dinner: { name: '清蒸鲈鱼', items: '鲈鱼200g、南瓜150g', kcal: 430 },
};

describe('nutritionMessages', () => {
  it('包含要分析的餐、热量与热量目标，并要求只输出 JSON', () => {
    const msgs = nutritionMessages(profile, 1500, ['breakfast', 'dinner'], meals);
    const user = msgs.at(-1)!.content;
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('JSON');
    expect(user).toContain('全麦鸡蛋三明治');
    expect(user).toContain('380');
    expect(user).toContain('清蒸鲈鱼');
    expect(user).toContain('1500');
    expect(user).toContain('"breakfast"');
    expect(user).not.toContain('"lunch"');
  });
});

const ok = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    meals: { breakfast: { protein: 22, carbs: 45, fat: 12 }, dinner: { protein: '35.25', carbs: 30, fat: 9 } },
    summary: '蛋白质充足，碳水略低。',
    suggestions: ['a', 'b'],
    ...over,
  });
const keys: MealKey[] = ['breakfast', 'dinner'];

describe('parseNutrition', () => {
  it('解析正常结果，字符串数字保留 1 位小数', () => {
    const r = parseNutrition('好的：' + ok(), keys);
    expect(r.meals.breakfast).toEqual({ protein: 22, carbs: 45, fat: 12 });
    expect(r.meals.dinner?.protein).toBe(35.3);
    expect(r.summary).toBe('蛋白质充足，碳水略低。');
    expect(r.suggestions).toEqual(['a', 'b']);
  });
  it('缺少某餐时报错', () => {
    expect(() => parseNutrition(ok({ meals: { breakfast: { protein: 1, carbs: 1, fat: 1 } } }), keys)).toThrow(ParseError);
  });
  it('克数越界或非数字时报错', () => {
    for (const bad of [301, -1, 'abc']) {
      const m = { breakfast: { protein: bad, carbs: 1, fat: 1 }, dinner: { protein: 1, carbs: 1, fat: 1 } };
      expect(() => parseNutrition(ok({ meals: m }), keys)).toThrow(ParseError);
    }
  });
  it('summary 为空时报错', () => {
    expect(() => parseNutrition(ok({ summary: '  ' }), keys)).toThrow(ParseError);
  });
  it('建议最多 3 条，过滤非字符串', () => {
    expect(parseNutrition(ok({ suggestions: ['1', 2, '3', '4', '5'] }), keys).suggestions).toEqual(['1', '3', '4']);
  });
});
