import { describe, expect, it } from 'vitest';
import type { PlanChatMessage, Profile, TrainingPrefs, WorkoutPlan, Weekday } from '../types';
import { prefsText } from '../domain/workout';
import { adjustWorkoutMessages, replaceExerciseMessages, workoutPlanMessages, workoutToText } from './workoutPrompts';

const profile: Profile = {
  heightCm: 170,
  startWeightKg: 80,
  targetWeightKg: 70,
  sex: 'male',
  age: 30,
  activity: 'sedentary',
  startDate: '2026-10-01',
};
const prefs: TrainingPrefs = { place: 'home', minutes: 30, daysPerWeek: 4, level: 'beginner', limits: '膝盖不好' };
const plan: WorkoutPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  days: [1, 2, 3, 4, 5, 6, 7].map((w) =>
    w % 2
      ? { weekday: w as Weekday, focus: '下肢力量', exercises: [{ id: `${w}a`, name: `深蹲${w}`, detail: '4 组 × 12 次', kcal: 60 }, { id: `${w}b`, name: '快走', detail: '20 分钟', kcal: 110 }] }
      : { weekday: w as Weekday, focus: '休息', exercises: [] },
  ),
};
const msg = (i: number): PlanChatMessage => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', text: `消息${i}`, at: '' });

describe('workoutPlanMessages', () => {
  it('包含训练条件、训练天数与长期要求', () => {
    const user = workoutPlanMessages(profile, 78, prefs, ['只有一副哑铃']).at(-1)!.content;
    expect(user).toContain(prefsText(prefs));
    expect(user).toContain('安排 4 个训练日');
    expect(user).toContain('【长期要求】');
    expect(user).toContain('只有一副哑铃');
  });
  it('没有记忆时不输出长期要求段落', () => {
    expect(workoutPlanMessages(profile, 78, prefs).at(-1)!.content).not.toContain('【长期要求】');
  });
});

describe('workoutToText', () => {
  it('每个动作一行，休息日输出“（无动作）”', () => {
    const lines = workoutToText(plan).split('\n');
    expect(lines).toHaveLength(4 * 2 + 3);
    expect(lines[0]).toBe('周一｜下肢力量｜深蹲1｜4 组 × 12 次｜60');
    expect(lines[2]).toBe('周二｜休息｜（无动作）');
  });
});

describe('replaceExerciseMessages', () => {
  it('包含原动作与 ±20% 热量区间', () => {
    const user = replaceExerciseMessages(profile, prefs, plan.days[0], plan.days[0].exercises[1]).at(-1)!.content;
    expect(user).toContain('快走');
    expect(user).toContain('88–132 kcal');
    expect(user).toContain('膝盖不好');
  });
});

describe('adjustWorkoutMessages', () => {
  const out = adjustWorkoutMessages({ profile, weightKg: 78, prefs, plan, memory: ['不能跳'], history: Array.from({ length: 10 }, (_, i) => msg(i)), userText: '深蹲膝盖疼怎么办' });
  it('首条 system，末条含用户输入、周表与记忆', () => {
    expect(out[0].role).toBe('system');
    const last = out.at(-1)!;
    expect(last.role).toBe('user');
    expect(last.content).toContain('深蹲膝盖疼怎么办');
    expect(last.content).toContain('深蹲7');
    expect(last.content).toContain('不能跳');
  });
  it('历史最多 6 条', () => {
    const hist = out.slice(1, -1);
    expect(hist).toHaveLength(6);
    expect(hist[0].content).toBe('消息4');
  });
});
