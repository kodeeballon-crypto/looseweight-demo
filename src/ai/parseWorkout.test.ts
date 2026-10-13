import { describe, expect, it } from 'vitest';
import { ParseError } from './parse';
import { normalizeExercise, parseExercise, parseWorkoutAdjustment, parseWorkoutPlan } from './parseWorkout';

const exA = { name: '徒手深蹲', detail: '4 组 × 12 次', kcal: 60 };
const exB = { name: '快走', detail: '20 分钟', kcal: '110' };
const trainDay = (w: number) => ({ weekday: w, focus: '下肢力量', exercises: [exA, exB] });
const restDay = (w: number) => ({ weekday: w, focus: '休息', exercises: [] });
const week = (over: Record<number, unknown> = {}) => ({
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => over[w] ?? (w % 2 ? trainDay(w) : restDay(w))),
  tips: ['a', 'b', 'c', 'd'],
});

describe('normalizeExercise', () => {
  it('接受字符串 kcal 并四舍五入，detail 缺省为空串', () => {
    expect(normalizeExercise({ name: ' 跳绳 ', kcal: '99.6' }, 'x')).toEqual({ id: 'x', name: '跳绳', detail: '', kcal: 100 });
  });
  it('拒绝缺名称或热量超出 10–800', () => {
    expect(normalizeExercise({ name: '', kcal: 50 })).toBeNull();
    expect(normalizeExercise({ name: '拉伸', kcal: 5 })).toBeNull();
    expect(normalizeExercise({ name: '马拉松', kcal: 2000 })).toBeNull();
  });
});

describe('parseWorkoutPlan', () => {
  it('解析 7 天计划，tips 最多 3 条，动作 id 唯一', () => {
    const p = parseWorkoutPlan('```json\n' + JSON.stringify(week()) + '\n```');
    expect(p.days).toHaveLength(7);
    expect(p.days[0].exercises[1].kcal).toBe(110);
    expect(p.days[1].exercises).toEqual([]);
    expect(p.tips).toEqual(['a', 'b', 'c']);
    const ids = p.days.flatMap((d) => d.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('丢弃超范围动作', () => {
    const p = parseWorkoutPlan(JSON.stringify(week({ 1: { weekday: 1, focus: '有氧', exercises: [exA, { name: '暴走', kcal: 5000 }] } })));
    expect(p.days[0].exercises.map((e) => e.name)).toEqual(['徒手深蹲']);
  });
  it('训练日没有任何合法动作时报错', () => {
    expect(() => parseWorkoutPlan(JSON.stringify(week({ 1: { weekday: 1, focus: '有氧', exercises: [{ name: 'x', kcal: 1 }] } })))).toThrow(ParseError);
  });
  it('不足 7 天报错', () => {
    expect(() => parseWorkoutPlan(JSON.stringify({ days: [trainDay(1)] }))).toThrow(ParseError);
  });
});

describe('parseExercise', () => {
  it('兼容 {exercise:{...}} 包裹', () => {
    expect(parseExercise(JSON.stringify({ exercise: exA })).name).toBe('徒手深蹲');
    expect(parseExercise(JSON.stringify(exA)).kcal).toBe(60);
  });
  it('不合法时报错', () => {
    expect(() => parseExercise('{"name":""}')).toThrow(ParseError);
  });
});

describe('parseWorkoutAdjustment', () => {
  it('缺 reply 报错', () => {
    expect(() => parseWorkoutAdjustment('{"changes":[]}')).toThrow(ParseError);
  });
  it('纯问答 changes 为空', () => {
    const a = parseWorkoutAdjustment('{"reply":"深蹲时膝盖与脚尖同向"}');
    expect(a.changes).toEqual([]);
    expect(a.memoryAdd).toEqual([]);
  });
  it('同一天取最后一条，非法 weekday 丢弃，记忆截断', () => {
    const a = parseWorkoutAdjustment(
      JSON.stringify({
        reply: '已调整',
        changes: [
          { weekday: 3, focus: '有氧', exercises: [exB] },
          { weekday: '3', focus: '核心', exercises: [exA] },
          { weekday: 9, focus: '有氧', exercises: [exA] },
        ],
        memoryAdd: ['膝盖不好', 'x'.repeat(50)],
        memoryRemove: [],
      }),
    );
    expect(a.changes).toHaveLength(1);
    expect(a.changes[0].weekday).toBe(3);
    expect(a.changes[0].next.focus).toBe('核心');
    expect(a.changes[0].next.weekday).toBe(3);
    expect(a.memoryAdd[1]).toHaveLength(30);
  });
});
