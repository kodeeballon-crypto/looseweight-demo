import type { ChatMessage } from './client';
import type { DailyRecord, KcalStatus, Meal, MealKey, Profile } from '../types';
import { MEAL_LABELS } from '../types';
import { ACTIVITY_LABELS, KCAL_STATUS_LABEL, bmiLevel, calcBmi, round1 } from '../domain/calc';

const SEX_LABEL = { male: '男', female: '女' } as const;

// ---------- 7.1 周食谱 ----------

const WEEK_SYSTEM = `你是一名经验丰富的注册营养师，擅长设计中式家常减脂餐。
你的方案科学、可执行、食材在中国普通超市/菜市场/外卖平台都容易获得。
你只输出一个合法的 JSON 对象，不要输出任何解释文字、不要使用 markdown 代码块。`;

const WEEK_EXAMPLE = `{
  "days": [
    {
      "weekday": 1,
      "meals": {
        "breakfast": { "name": "全麦鸡蛋三明治", "items": "全麦面包2片(70g)、水煮蛋1个、生菜30g、无糖豆浆250ml", "kcal": 380 },
        "lunch": { "name": "鸡胸肉藜麦饭", "items": "鸡胸肉150g、藜麦饭100g、西兰花200g", "kcal": 520 },
        "dinner": { "name": "清蒸鲈鱼配杂粮", "items": "鲈鱼200g、蒸南瓜150g、清炒菠菜200g", "kcal": 430 },
        "snack": { "name": "希腊酸奶配蓝莓", "items": "无糖希腊酸奶150g、蓝莓50g", "kcal": 160 }
      }
    }
  ],
  "tips": ["要点1", "要点2", "要点3"]
}`;

export function weekPlanMessages(profile: Profile, currentWeight: number, kcalTarget: number): ChatMessage[] {
  const bmi = calcBmi(currentWeight, profile.heightCm);
  const user = `请为我制定一周（周一到周日）的减脂饮食计划。

【个人信息】
- 性别：${SEX_LABEL[profile.sex]}
- 年龄：${profile.age} 岁
- 身高：${profile.heightCm} cm
- 当前体重：${round1(currentWeight)} kg
- 目标体重：${profile.targetWeightKg} kg
- BMI：${bmi.toFixed(1)}（${bmiLevel(bmi).label}）
- 活动量：${ACTIVITY_LABELS[profile.activity]}
- 每日热量目标：${kcalTarget} kcal
- 饮食偏好/忌口：${profile.preferences?.trim() || '无特别要求'}

【要求】
1. 每天 4 餐：breakfast（早餐）、lunch（午餐）、dinner（晚餐）、snack（加餐）。
2. 每天四餐总热量控制在 ${Math.round(kcalTarget * 0.95)}–${Math.round(kcalTarget * 1.05)} kcal 之间。
3. 使用中国家常、容易买到的食材，做法简单，也要外卖友好（午餐可以是能点到的外卖）。
4. 高蛋白、适量优质碳水、多蔬菜，少油少糖少盐。
5. 7 天菜品尽量不重复。
6. items 字段写清楚每种食材的份量（克/毫升/个）。
7. kcal 为该餐热量的整数估算。
8. tips 给出本周 3 条以内简短实用的要点。
9. days 数组必须正好 7 项，weekday 依次为 1–7（周一=1）。

【输出 JSON 结构示例（只示意 1 天，你需要输出完整 7 天）】
${WEEK_EXAMPLE}`;

  return [
    { role: 'system', content: WEEK_SYSTEM },
    { role: 'user', content: user },
  ];
}

// ---------- 7.2 单餐替换 ----------

export function replaceMealMessages(
  profile: Profile,
  mealKey: MealKey,
  original: Meal,
  otherMeals: Partial<Record<MealKey, Meal>>,
): ChatMessage[] {
  const min = Math.round(original.kcal * 0.85);
  const max = Math.round(original.kcal * 1.15);
  const others = Object.entries(otherMeals)
    .map(([k, m]) => `- ${MEAL_LABELS[k as MealKey]}：${m!.name}（${m!.kcal} kcal）`)
    .join('\n');

  const user = `请帮我替换当天的【${MEAL_LABELS[mealKey]}】，换一个不同的菜。

原来的${MEAL_LABELS[mealKey]}：${original.name}（${original.items}，${original.kcal} kcal）
当天其他餐：
${others || '- 无'}

要求：
1. 热量在 ${min}–${max} kcal 之间。
2. 与原菜和当天其他餐不重复，中式家常、食材易得、外卖友好。
3. 饮食偏好/忌口：${profile.preferences?.trim() || '无特别要求'}。
4. items 写清楚份量（克/毫升/个）。

只输出 JSON：{ "name": "菜名", "items": "份量说明", "kcal": 整数 }`;

  return [
    { role: 'system', content: WEEK_SYSTEM },
    { role: 'user', content: user },
  ];
}

// ---------- 7.3 鼓励语 ----------

export interface EncourageInput {
  recent: DailyRecord[]; // 最近 14 天
  delta: number | null; // 今日 vs 上次
  avgTrend: number | null; // 7 日均线变化（今天均值 - 7 天前均值）
  kcal: KcalStatus | null;
  streak: number;
  totalLoss: number;
  targetWeight: number;
}

export function encouragementMessages(profile: Profile, input: EncourageInput): ChatMessage[] {
  const series = input.recent.map((r) => `${r.date.slice(5)} ${r.weightKg}kg`).join('，');
  const fmt = (n: number | null) => (n === null ? '暂无' : `${n > 0 ? '+' : ''}${n.toFixed(1)} kg`);

  const user = `我正在减重，今天刚完成打卡，请给我一段鼓励。

【我的数据】
- 性别：${SEX_LABEL[profile.sex]}，目标体重 ${input.targetWeight} kg
- 最近体重记录：${series || '仅今天一条'}
- 今天比上一次：${fmt(input.delta)}
- 7 日均线趋势：${fmt(input.avgTrend)}
- 今日热量状态：${input.kcal ? KCAL_STATUS_LABEL[input.kcal] : '未记录饮食'}
- 连续打卡：${input.streak} 天
- 累计减重：${input.totalLoss.toFixed(1)} kg

【要求】
1. 80–150 个汉字，像一位温暖真诚的朋友，可以用 1–2 个 emoji。
2. 具体引用上面的数据，不要空泛套话，不要说教。
3. 如果体重上升，解释这可能是正常波动（水分、钠摄入、睡眠、生理期等）并安抚情绪。
4. 不给任何医疗建议。

只输出 JSON：{ "text": "鼓励内容" }`;

  return [
    { role: 'system', content: '你是一位温暖、真诚、懂营养学的减重陪伴教练。你只输出合法 JSON。' },
    { role: 'user', content: user },
  ];
}

export const PING_MESSAGES: ChatMessage[] = [{ role: 'user', content: '请只回复两个字：你好' }];
