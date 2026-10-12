import { describe, expect, it } from 'vitest';
import { CORPUS, offlineEncouragement, pickScenario, type EncourageContext, type Scenario } from './encourage';

const base: EncourageContext = { isFirst: false, delta: 0, streak: 1, kcal: null, newMilestone: false, totalLoss: 2 };

describe('场景判定', () => {
  const cases: [Partial<EncourageContext>, Scenario][] = [
    [{ isFirst: true, newMilestone: true }, 'first'],
    [{ newMilestone: true, streak: 7 }, 'milestone'],
    [{ streak: 30 }, 'streak30'],
    [{ streak: 7, delta: -1 }, 'streak7'],
    [{ streak: 3 }, 'streak3'],
    [{ delta: -0.3 }, 'down'],
    [{ delta: 0.5 }, 'up'],
    [{ delta: 0.05, kcal: 'ok' }, 'kcalOk'],
    [{ delta: 0, kcal: 'over' }, 'kcalOver'],
    [{ delta: 0, kcal: 'slight' }, 'flat'],
    [{ delta: null }, 'flat'],
  ];
  it.each(cases)('%o → %s', (patch, expected) => {
    expect(pickScenario({ ...base, ...patch })).toBe(expected);
  });
});

describe('语料', () => {
  it('每类至少 5 条', () => {
    for (const list of Object.values(CORPUS)) expect(list.length).toBeGreaterThanOrEqual(5);
  });
  it('占位符会被替换', () => {
    const text = offlineEncouragement({ ...base, delta: -0.46 }, () => 0);
    expect(text).toContain('0.5');
    expect(text).not.toMatch(/\{\w+\}/);
  });
  it('所有模板替换后都不含占位符', () => {
    for (const s of Object.keys(CORPUS) as Scenario[]) {
      for (let i = 0; i < CORPUS[s].length; i++) {
        const ctx: EncourageContext = { ...base, isFirst: s === 'first' };
        const t = offlineEncouragement(ctx, () => i / CORPUS[s].length);
        expect(t).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
