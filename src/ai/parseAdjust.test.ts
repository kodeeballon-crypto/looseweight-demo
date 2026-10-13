import { describe, expect, it } from 'vitest';
import { ParseError, parsePlanAdjustment } from './parse';

const ok = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    reply: '已把工作日早餐换成便利店组合',
    changes: [{ weekday: 1, meal: 'breakfast', name: '饭团+豆浆', items: '金枪鱼饭团1个、无糖豆浆1盒', kcal: 380 }],
    memoryAdd: ['工作日不做早饭'],
    memoryRemove: [],
    ...extra,
  });

describe('parsePlanAdjustment', () => {
  it('解析合法输出', () => {
    const r = parsePlanAdjustment(ok());
    expect(r.reply).toContain('便利店');
    expect(r.changes).toEqual([
      { weekday: 1, meal: 'breakfast', next: { name: '饭团+豆浆', items: '金枪鱼饭团1个、无糖豆浆1盒', kcal: 380 } },
    ]);
    expect(r.memoryAdd).toEqual(['工作日不做早饭']);
    expect(r.memoryRemove).toEqual([]);
  });

  it('接受字符串形式的 weekday', () => {
    const r = parsePlanAdjustment(ok({ changes: [{ weekday: '2', meal: 'lunch', name: 'A', items: 'a', kcal: 500 }] }));
    expect(r.changes[0].weekday).toBe(2);
  });

  it('丢弃非法条目', () => {
    const r = parsePlanAdjustment(
      ok({
        changes: [
          { weekday: 8, meal: 'lunch', name: 'A', items: 'a', kcal: 500 },
          { weekday: 1, meal: 'supper', name: 'B', items: 'b', kcal: 500 },
          { weekday: 1, meal: 'lunch', name: 'C', items: 'c', kcal: 5 },
          { weekday: 1.5, meal: 'lunch', name: 'D', items: 'd', kcal: 500 },
          { weekday: 1, meal: 'lunch', name: '', items: 'e', kcal: 500 },
          { weekday: 3, meal: 'dinner', name: 'OK', items: 'ok', kcal: 450 },
        ],
      }),
    );
    expect(r.changes.map((c) => c.next.name)).toEqual(['OK']);
  });

  it('同一格出现多次取最后一条', () => {
    const r = parsePlanAdjustment(
      ok({
        changes: [
          { weekday: 1, meal: 'lunch', name: '第一版', items: 'a', kcal: 500 },
          { weekday: 1, meal: 'lunch', name: '第二版', items: 'b', kcal: 520 },
        ],
      }),
    );
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].next.name).toBe('第二版');
  });

  it('changes 不是数组时视为无改动', () => {
    expect(parsePlanAdjustment(ok({ changes: null })).changes).toEqual([]);
  });

  it('缺少 reply 抛 ParseError', () => {
    expect(() => parsePlanAdjustment(ok({ reply: '' }))).toThrow(ParseError);
    expect(() => parsePlanAdjustment('不是 JSON')).toThrow(ParseError);
  });

  it('记忆条目截断到 30 字且最多 5 条，过滤非字符串', () => {
    const long = '很'.repeat(40);
    const r = parsePlanAdjustment(ok({ memoryAdd: [long, 'a', 'b', 'c', 'd', 'e', 1, ' '], memoryRemove: 'x' }));
    expect(r.memoryAdd).toHaveLength(5);
    expect(r.memoryAdd[0]).toHaveLength(30);
    expect(r.memoryRemove).toEqual([]);
  });
});
