import { describe, expect, it } from 'vitest';
import { buildExport, validateImport } from './dataio';

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

const meal = (name: string, kcal: unknown) => ({ name, items: `${name}份量`, kcal });
const planRaw = (kcal: unknown = 400) => ({
  createdAt: '2026-10-12T00:00:00.000Z',
  dailyKcalTarget: 1800,
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w,
    meals: { breakfast: meal('鸡蛋', kcal), lunch: meal('午饭', 600), dinner: meal('晚饭', 500), snack: meal('加餐', 100) },
  })),
  tips: ['多喝水'],
});
const profile = { heightCm: 175, startWeightKg: 85, targetWeightKg: 75, sex: 'male', age: 30, activity: 'light', startDate: '2026-10-01' };

describe('validateImport 规范化', () => {
  it('字符串热量被规范化为数字（不再出现 "400"+... 拼接成 4000）', () => {
    const d = validateImport({ ...base, plan: planRaw('400') });
    const b = d.plan!.days[0].meals.breakfast;
    expect(b.kcal).toBe(400);
    expect(typeof b.kcal).toBe('number');
  });

  it('保留英文鼓励语与餐食快照，快照热量同样规范化', () => {
    const d = validateImport({
      ...base,
      records: [
        {
          date: '2026-10-12',
          weightKg: 80,
          mealsEaten: ['breakfast', 'breakfast', 'junk'],
          encouragement: '加油',
          encouragementEn: 'Keep going!',
          mealSnapshot: { breakfast: meal('鸡蛋', '400'), bogus: meal('x', 1) },
        },
      ],
    });
    const r = d.records[0];
    expect(r.mealsEaten).toEqual(['breakfast']);
    expect(r.encouragementEn).toBe('Keep going!');
    expect(r.mealSnapshot).toEqual({ breakfast: { name: '鸡蛋', items: '鸡蛋份量', kcal: 400 } });
  });

  it('拒绝非法活动量、超范围数值、重复日期与重复星期', () => {
    expect(() => validateImport({ ...base, profile: { ...profile, activity: 'couch' } })).toThrow('活动量');
    expect(() => validateImport({ ...base, profile: { ...profile, heightCm: 20 } })).toThrow('个人档案');
    expect(() => validateImport({ ...base, records: [{ date: '2026-10-12', weightKg: 900, mealsEaten: [] }] })).toThrow('第 1 条');
    expect(() => validateImport({ ...base, records: [{ date: '2026-02-30', weightKg: 80, mealsEaten: [] }] })).toThrow('第 1 条');
    expect(() =>
      validateImport({ ...base, records: [{ date: '2026-10-12', weightKg: 80, mealsEaten: [], extraKcal: -5 }] }),
    ).toThrow('第 1 条');
    expect(() =>
      validateImport({
        ...base,
        records: [
          { date: '2026-10-12', weightKg: 80, mealsEaten: [] },
          { date: '2026-10-12', weightKg: 79, mealsEaten: [] },
        ],
      }),
    ).toThrow('重复');
    const dup = planRaw();
    dup.days[1].weekday = 1;
    expect(() => validateImport({ ...base, plan: dup })).toThrow('饮食计划');
  });

  it('非法 settings 字段被丢弃，合法字段保留', () => {
    const d = validateImport({ ...base, settings: { baseUrl: 'https://api.deepseek.com', model: 42, directMode: 'yes' } });
    expect(d.settings).toEqual({ baseUrl: 'https://api.deepseek.com' });
  });

  it('导出 → 导入往返不丢字段', () => {
    const state = {
      profile: { ...profile, activity: 'light' as const, sex: 'male' as const },
      records: [
        {
          date: '2026-10-12',
          weightKg: 80,
          mealsEaten: ['breakfast' as const],
          extraKcal: 150,
          encouragement: '加油',
          encouragementEn: 'Keep going!',
          mealSnapshot: { breakfast: { name: '鸡蛋', items: '鸡蛋份量', kcal: 400, nameEn: 'Eggs' } },
        },
      ],
      plan: planRaw() as never,
      seenBadges: ['first'],
      settings: { baseUrl: 'https://api.deepseek.com', apiKey: 'sk-secret', model: 'deepseek-flash', directMode: false },
      planMemory: ['不吃香菜'],
      planChat: [],
      trainingPrefs: null,
      workoutPlan: null,
      workoutLog: {},
      workoutChat: [],
      workoutMemory: [],
    };
    const exported = JSON.parse(JSON.stringify(buildExport(state)));
    expect(JSON.stringify(exported)).not.toContain('sk-secret');
    const back = validateImport(exported);
    expect(back.records).toEqual(state.records);
    expect(back.plan?.days[0].meals.breakfast.kcal).toBe(400);
    expect(back.plan?.tips).toEqual(['多喝水']);
    expect(back.settings).toEqual({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', directMode: false });
    expect(back.planMemory).toEqual(['不吃香菜']);
  });
});
