import { describe, expect, it } from 'vitest';
import type { Meal, PlanChatMessage, Profile, WeekPlan, Weekday } from '../types';
import { DEFAULT_LIFESTYLE } from '../types';
import { lifestyleText } from '../domain/lifestyle';
import { adjustPlanMessages, planToText, weekPlanMessages } from './prompts';

const profile: Profile = {
  heightCm: 170,
  startWeightKg: 80,
  targetWeightKg: 70,
  sex: 'female',
  age: 28,
  activity: 'sedentary',
  startDate: '2026-10-01',
};
const m = (name: string, kcal: number): Meal => ({ name, items: `${name}份量`, kcal });
const plan: WeekPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  dailyKcalTarget: 1700,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w as Weekday,
    meals: { breakfast: m(`早${w}`, 400), lunch: m(`午${w}`, 600), dinner: m(`晚${w}`, 500), snack: m(`加${w}`, 200) },
  })),
};
const msg = (i: number): PlanChatMessage => ({
  id: String(i),
  role: i % 2 ? 'assistant' : 'user',
  text: `消息${i}`,
  at: '2026-10-13T00:00:00.000Z',
});

describe('weekPlanMessages', () => {
  it('包含生活节奏与长期要求', () => {
    const user = weekPlanMessages(profile, 78, 1700, ['工作日不做早饭', '不吃牛肉']).at(-1)!.content;
    expect(user).toContain(lifestyleText(DEFAULT_LIFESTYLE));
    expect(user).toContain('【长期要求】');
    expect(user).toContain('工作日不做早饭');
    expect(user).toContain('不吃牛肉');
  });
  it('没有记忆时不输出长期要求段落', () => {
    expect(weekPlanMessages(profile, 78, 1700).at(-1)!.content).not.toContain('【长期要求】');
  });
});

describe('planToText', () => {
  it('输出 28 行，每行含星期、餐次、菜名和热量', () => {
    const lines = planToText(plan).split('\n');
    expect(lines).toHaveLength(28);
    expect(lines[0]).toContain('周一');
    expect(lines[0]).toContain('早餐');
    expect(lines[0]).toContain('早1');
    expect(lines[0]).toContain('400');
  });
});

describe('adjustPlanMessages', () => {
  const history = Array.from({ length: 10 }, (_, i) => msg(i));
  const out = adjustPlanMessages({ profile, kcalTarget: 1700, plan, memory: ['午餐外卖'], history, userText: '早上没时间做饭' });

  it('首条为 system，最后一条是包含用户输入与周表的 user 消息', () => {
    expect(out[0].role).toBe('system');
    const last = out.at(-1)!;
    expect(last.role).toBe('user');
    expect(last.content).toContain('早上没时间做饭');
    expect(last.content).toContain('晚7');
    expect(last.content).toContain('午餐外卖');
  });

  it('历史最多带 6 条并保持角色', () => {
    const hist = out.slice(1, -1);
    expect(hist).toHaveLength(6);
    expect(hist[0].content).toBe('消息4');
    expect(hist.map((h) => h.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  });

  it('lang=en 时要求 AI 以英文输出食谱与鼓励语', () => {
    const enPlanMsgs = weekPlanMessages(profile, 78, 1700, [], 'en');
    expect(enPlanMsgs.at(-1)!.content).toContain('Output language: English.');
    expect(enPlanMsgs.at(-1)!.content).toContain('MUST be written in natural, concise English');
  });
});

