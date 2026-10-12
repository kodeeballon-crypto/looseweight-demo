import { describe, expect, it } from 'vitest';
import { ParseError, extractJson, parseEncouragement, parseMeal, parseWeekPlan } from './parse';

const meal = (n: string, kcal: number | string = 400) => ({ name: n, items: '鸡胸肉150g', kcal });
const day = (w: number) => ({
  weekday: w,
  meals: { breakfast: meal('早' + w), lunch: meal('午' + w, 550), dinner: meal('晚' + w, 450), snack: meal('加' + w, 150) },
});
const week = { days: [1, 2, 3, 4, 5, 6, 7].map(day), tips: ['多喝水', '早睡', '少油', '第四条会被截掉'] };

describe('extractJson', () => {
  it('解析 ```json 包裹', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('忽略前后多余文字', () => {
    expect(extractJson('好的，这是计划：{"a":{"b":2}} 祝你成功！{"c":3}')).toEqual({ a: { b: 2 } });
  });
  it('字符串中的花括号不影响匹配', () => {
    expect(extractJson('{"t":"a}b{c","n":1}')).toEqual({ t: 'a}b{c', n: 1 });
  });
  it('没有 JSON 时抛 ParseError', () => {
    expect(() => extractJson('抱歉，我无法回答')).toThrow(ParseError);
  });
  it('JSON 不完整时抛 ParseError', () => {
    expect(() => extractJson('{"a": 1')).toThrow(ParseError);
  });
});

describe('parseWeekPlan', () => {
  it('解析完整 7 天 × 4 餐', () => {
    const p = parseWeekPlan('```json\n' + JSON.stringify(week) + '\n```', 1600, new Date('2026-10-12T00:00:00Z'));
    expect(p.days).toHaveLength(7);
    expect(p.days[6].weekday).toBe(7);
    expect(p.days[0].meals.lunch.kcal).toBe(550);
    expect(p.dailyKcalTarget).toBe(1600);
    expect(p.tips).toHaveLength(3);
    expect(p.createdAt).toBe('2026-10-12T00:00:00.000Z');
  });
  it('kcal 为数字字符串时转换', () => {
    const w = { days: week.days.map((d) => ({ ...d, meals: { ...d.meals, snack: meal('x', '120') } })) };
    expect(parseWeekPlan(JSON.stringify(w), 1600).days[0].meals.snack.kcal).toBe(120);
  });
  it('天数不足报错', () => {
    expect(() => parseWeekPlan(JSON.stringify({ days: week.days.slice(0, 5) }), 1600)).toThrow('AI 返回格式不正确');
  });
  it('缺少餐次报错', () => {
    const w = { days: week.days.map((d, i) => (i === 3 ? { ...d, meals: { breakfast: d.meals.breakfast } } : d)) };
    expect(() => parseWeekPlan(JSON.stringify(w), 1600)).toThrow(ParseError);
  });
  it('kcal 非正数报错', () => {
    const w = { days: week.days.map((d, i) => (i === 0 ? { ...d, meals: { ...d.meals, lunch: meal('x', 0) } } : d)) };
    expect(() => parseWeekPlan(JSON.stringify(w), 1600)).toThrow(ParseError);
  });
  it('缺少菜名报错', () => {
    const w = { days: week.days.map((d, i) => (i === 0 ? { ...d, meals: { ...d.meals, lunch: { items: 'a', kcal: 300 } } } : d)) };
    expect(() => parseWeekPlan(JSON.stringify(w), 1600)).toThrow(ParseError);
  });
  it('没有 days 字段报错', () => {
    expect(() => parseWeekPlan('{"plan":[]}', 1600)).toThrow(ParseError);
  });
});

describe('parseMeal / parseEncouragement', () => {
  it('解析单餐，兼容 meal 包裹', () => {
    expect(parseMeal('{"name":"番茄牛腩","items":"牛腩120g","kcal":480}')).toEqual({ name: '番茄牛腩', items: '牛腩120g', kcal: 480 });
    expect(parseMeal('{"meal":{"name":"a","items":["鸡蛋1个","牛奶200ml"],"kcal":300}}').items).toBe('鸡蛋1个、牛奶200ml');
  });
  it('单餐非法报错', () => {
    expect(() => parseMeal('{"name":"a"}')).toThrow(ParseError);
  });
  it('鼓励语兼容 JSON 与纯文本', () => {
    expect(parseEncouragement('{"text":"你真棒"}')).toBe('你真棒');
    expect(parseEncouragement('今天也很棒！')).toBe('今天也很棒！');
  });
});
