import { describe, expect, it } from 'vitest';
import { validateImport } from './dataio';

const ex = (name: string, kcal: number) => ({ id: name, name, detail: '', kcal });
const workoutPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, focus: '力量', exercises: [ex(`深蹲${w}`, 60)] })),
};
const base = { app: 'looseweight', records: [], profile: null, plan: null, seenBadges: [] };

describe('validateImport 训练数据', () => {
  it('导入合法训练数据', () => {
    const d = validateImport({
      ...base,
      trainingPrefs: { place: 'gym', minutes: 45, daysPerWeek: 5, level: 'base', limits: '' },
      workoutPlan,
      workoutLog: { '2026-10-13': [{ id: 'a', name: '快走', kcal: 110 }] },
      workoutMemory: ['膝盖不好'],
      workoutChat: [{ id: '1', role: 'user', text: 'hi', at: '2026-10-13T00:00:00Z' }],
    });
    expect(d.trainingPrefs?.place).toBe('gym');
    expect(d.workoutPlan?.days).toHaveLength(7);
    expect(d.workoutLog?.['2026-10-13']).toHaveLength(1);
    expect(d.workoutMemory).toEqual(['膝盖不好']);
    expect(d.workoutChat).toHaveLength(1);
  });

  it('缺少训练字段时给默认值（兼容旧备份）', () => {
    const d = validateImport(base);
    expect(d.trainingPrefs).toBeNull();
    expect(d.workoutPlan).toBeNull();
    expect(d.workoutLog).toEqual({});
    expect(d.workoutChat).toEqual([]);
    expect(d.workoutMemory).toEqual([]);
  });

  it('非法训练条件置为 null', () => {
    expect(validateImport({ ...base, trainingPrefs: { place: 'pool' } }).trainingPrefs).toBeNull();
  });

  it('训练计划缺天或动作不完整时报错', () => {
    expect(() => validateImport({ ...base, workoutPlan: { days: workoutPlan.days.slice(0, 3) } })).toThrow('训练计划数据不完整');
    const bad = { ...workoutPlan, days: workoutPlan.days.map((d, i) => (i ? d : { ...d, exercises: [{ name: '', kcal: 10 }] })) };
    expect(() => validateImport({ ...base, workoutPlan: bad })).toThrow('训练计划中有动作数据不完整');
  });

  it('workoutLog 过滤非法日期与条目', () => {
    const d = validateImport({
      ...base,
      workoutLog: { bad: [{ id: 'a', name: 'x', kcal: 10 }], '2026-10-12': [{ id: 'a', name: 'x', kcal: -1 }], '2026-10-13': [{ id: 'b', name: 'y', kcal: 50 }, 'junk'] },
    });
    expect(d.workoutLog).toEqual({ '2026-10-13': [{ id: 'b', name: 'y', kcal: 50 }] });
  });
});
