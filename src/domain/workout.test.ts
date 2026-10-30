import { describe, expect, it } from 'vitest';
import type { Exercise, TrainingPrefs, WorkoutDay, WorkoutLog, WorkoutPlan, Weekday } from '../types';
import {
  DEFAULT_PREFS,
  applyWorkoutChanges,
  burnedOn,
  completeAll,
  dayBurn,
  isPrefs,
  isRestDay,
  netIntake,
  prefsText,
  toggleDone,
  weekBurn,
} from './workout';

const ex = (id: string, kcal: number): Exercise => ({ id, name: `动作${id}`, detail: '3 组', kcal });
const day = (w: number, exs: Exercise[], focus = '力量'): WorkoutDay => ({ weekday: w as Weekday, focus, exercises: exs });
const plan: WorkoutPlan = {
  createdAt: '2026-10-13T00:00:00.000Z',
  days: [1, 2, 3, 4, 5, 6, 7].map((w) => day(w, [ex(`${w}a`, 100), ex(`${w}b`, 50)])),
};
const D = '2026-10-13';

describe('burnedOn', () => {
  it('累加当天快照，无记录为 0', () => {
    const log: WorkoutLog = { [D]: [{ id: 'a', name: 'x', kcal: 120 }, { id: 'b', name: 'y', kcal: 30 }] };
    expect(burnedOn(log, D)).toBe(150);
    expect(burnedOn(log, '2026-10-12')).toBe(0);
  });
});

describe('toggleDone', () => {
  it('勾选写入快照，再次调用取消，清空时删除日期键', () => {
    const e = ex('a', 80);
    const empty: WorkoutLog = {};
    const on = toggleDone(empty, D, e);
    expect(on[D]).toEqual([{ id: 'a', name: '动作a', kcal: 80 }]);
    expect(empty).toEqual({});
    const off = toggleDone(on, D, e);
    expect(D in off).toBe(false);
    expect(on[D]).toHaveLength(1);
  });
});

describe('completeAll', () => {
  it('只追加未勾选的动作', () => {
    const log = toggleDone({}, D, ex('a', 80));
    const all = completeAll(log, D, [ex('a', 80), ex('b', 40)]);
    expect(all[D].map((e) => e.id)).toEqual(['a', 'b']);
    expect(burnedOn(all, D)).toBe(120);
  });
  it('全部已勾时返回原对象', () => {
    const log = toggleDone({}, D, ex('a', 80));
    expect(completeAll(log, D, [ex('a', 80)])).toBe(log);
  });
});

describe('dayBurn / weekBurn', () => {
  it('按计划求和', () => {
    expect(dayBurn(plan.days[0])).toBe(150);
    expect(weekBurn(plan)).toBe(1050);
  });
});

describe('applyWorkoutChanges', () => {
  it('只替换指定天，其它天保持原引用', () => {
    const next = day(3, [ex('new', 200)], '有氧');
    const out = applyWorkoutChanges(plan, [{ weekday: 3, next }]);
    expect(out.days[2]).toBe(next);
    expect(out.days[0]).toBe(plan.days[0]);
    expect(plan.days[2].focus).toBe('力量');
  });
  it('空改动返回原计划', () => {
    expect(applyWorkoutChanges(plan, [])).toBe(plan);
  });
});

describe('netIntake', () => {
  it('摄入减消耗，不低于 0', () => {
    expect(netIntake(1500, 300)).toBe(1200);
    expect(netIntake(200, 500)).toBe(0);
  });
});

describe('prefs', () => {
  it('prefsText 包含场地、时长、天数与限制', () => {
    const p: TrainingPrefs = { place: 'gym', minutes: 45, daysPerWeek: 5, level: 'base', limits: '膝盖不好' };
    const t = prefsText(p);
    expect(t).toContain('健身房');
    expect(t).toContain('45 分钟');
    expect(t).toContain('5 天');
    expect(t).toContain('膝盖不好');
    expect(prefsText(DEFAULT_PREFS)).toContain('伤病/限制：无');
  });
  it('isPrefs 校验枚举', () => {
    expect(isPrefs(DEFAULT_PREFS)).toBe(true);
    expect(isPrefs({ ...DEFAULT_PREFS, minutes: 25 })).toBe(false);
    expect(isPrefs({ ...DEFAULT_PREFS, place: 'pool' })).toBe(false);
    expect(isPrefs(null)).toBe(false);
  });
});

describe('isRestDay', () => {
  it('focus 含“休息”即为休息日', () => {
    expect(isRestDay(day(1, [], '休息·拉伸'))).toBe(true);
    expect(isRestDay(day(1, [], '下肢力量'))).toBe(false);
  });

  it('英文只匹配完整单词 Rest，不误判 Restorative / Forest', () => {
    expect(isRestDay(day(1, [], 'Rest · Stretch'))).toBe(true);
    expect(isRestDay(day(1, [], 'Restorative Yoga'))).toBe(false);
    expect(isRestDay(day(1, [], 'Forest Walk'))).toBe(false);
  });

  it('显式 rest 标记优先于关键词', () => {
    expect(isRestDay({ ...day(1, [], '放松日'), rest: true })).toBe(true);
    expect(isRestDay({ ...day(1, [], '休息后的力量训练'), rest: false })).toBe(false);
  });
});
