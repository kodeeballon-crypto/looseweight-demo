import type { ChatMessage } from './client';
import type { Meal, MealKey, Profile } from '../types';
import { MEAL_KEYS, MEAL_LABELS } from '../types';
import { getLang } from '../i18n';
import type { Lang } from '../i18n/types';
import { SEX_LABEL } from './prompts';


const NUTRITIONIST_SYSTEM = `你是一名注册营养师，擅长估算家常菜的三大营养素并点评减脂期的饮食结构。
你只输出一个合法的 JSON 对象，不要输出任何解释文字、不要使用 markdown 代码块。`;

const EN_NUTRITION_RULE = `\n\n【Output Language Requirement】\nOutput language: English.\n"summary" and "suggestions" MUST be written in natural, concise English. Output strictly valid JSON only.`;

/** 让 AI 估算今日各餐的蛋白质/碳水/脂肪克数，并点评结构 */
export function nutritionMessages(
  profile: Profile,
  kcalTarget: number,
  keys: MealKey[],
  meals: Partial<Record<MealKey, Meal>>,
  lang: Lang = getLang(),
): ChatMessage[] {
  const ordered = MEAL_KEYS.filter((k) => keys.includes(k) && meals[k]);
  const lines = ordered.map((k) => `- ${k}（${MEAL_LABELS[k]}）｜${meals[k]!.name}｜${meals[k]!.items}｜${meals[k]!.kcal} kcal`).join('\n');
  const example = ordered.map((k) => `"${k}": { "protein": 克, "carbs": 克, "fat": 克 }`).join(', ');

  const user = `请分析我今天的饮食营养结构。

【个人信息】${SEX_LABEL[profile.sex]}，${profile.age} 岁，目标体重 ${profile.targetWeightKg} kg，每日热量目标 ${kcalTarget} kcal（减脂期）
【今日餐食】（餐次｜菜名｜份量｜热量）
${lines}

【要求】
1. 按份量估算每餐的蛋白质、碳水化合物、脂肪克数（数字，可保留 1 位小数），换算热量（蛋白×4 + 碳水×4 + 脂肪×9）应与该餐 kcal 大致吻合。
2. 参考减脂期热量占比：蛋白质 25–35%、碳水 40–50%、脂肪 20–30%，用不超过 120 字点评今天的结构（哪里合理、哪里需要注意）。
3. 给出最多 3 条具体可执行的改进建议（例如把某样食物换成什么、增减多少克）。
4. meals 中必须包含且只包含上面列出的餐次键。

只输出 JSON：{ "meals": { ${example} }, "summary": "点评", "suggestions": ["建议1"] }${lang === 'en' ? EN_NUTRITION_RULE : ''}`;

  return [
    { role: 'system', content: NUTRITIONIST_SYSTEM },
    { role: 'user', content: user },
  ];
}
