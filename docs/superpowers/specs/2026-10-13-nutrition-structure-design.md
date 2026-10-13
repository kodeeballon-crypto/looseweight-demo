# 今日营养结构（饮食周表）设计

日期：2026-10-13 · 状态：已确认

## 目标

在「饮食周表」页展示今日吃食的三大营养素配比饼图，并给出结构分析（本地规则评级 + AI 点评与建议）。

## 决策

| 项 | 决定 |
|---|---|
| 营养数据来源 | 按需：点「✨ 分析今日饮食」时由 AI 估算每餐蛋白质/碳水/脂肪克数；旧周表无需重新生成 |
| 统计范围 | 今日已打卡 → 只统计 `mealsEaten`；未打卡 → 今日计划 4 餐，标注「按计划预览」 |
| 计划外摄入 | 不计入饼图，旁注「计划外 X kcal 未计入」 |
| 位置 | 饮食周表页 `plan-main` 内，WeekTable 下方、「本周要点」上方 |
| 缓存 | 按日期存本机，保留最近 14 天，不进入导出备份 |
| 过期判断 | 分析时记录餐食签名；签名变化 → 提示「餐食已变化，点击重新分析」 |

## 数据

```ts
interface Macros { protein: number; carbs: number; fat: number } // 克
interface NutritionAnalysis {
  date: string;            // YYYY-MM-DD
  signature: string;       // 分析时的餐食签名
  meals: Partial<Record<MealKey, Macros>>;
  summary: string;         // AI 点评
  suggestions: string[];   // ≤3 条
  at: string;              // ISO
}
type NutritionCache = Record<string, NutritionAnalysis>;
```

Store 新增 `nutritionCache` 与 `setNutrition(a)`（写入后裁剪到最近 14 天）。persist 升到 v4，migrate 时非对象则置 `{}`。`clearAll` 清空；`importData` 不覆盖（置 `{}`）。

## 纯函数（`src/domain/nutrition.ts`）

- `todayMeals(plan, record, weekday)` → `{ keys: MealKey[]; meals: Record<MealKey, Meal>; preview: boolean }`
  - 有今日记录：`keys = record.mealsEaten`，`preview=false`；否则 4 餐，`preview=true`；无计划 → keys 为空。
- `mealSignature(keys, meals)`：按 MEAL_KEYS 顺序拼接 `key|name|items|kcal`。
- `sumMacros(analysis, keys)`：只累加 keys 中的餐。
- `macroShares(m)`：热量 = 蛋白×4 / 碳水×4 / 脂肪×9，返回各占比（%，总和为 0 时全 0）。
- `rateShare(kind, pct)` → `'low' | 'ok' | 'high'`，参考范围：蛋白 25–35、碳水 40–50、脂肪 20–30（含边界为 ok）。
- `pruneCache(cache, keep=14)`：按日期保留最近 N 天。

## AI

- `nutritionMessages(profile, kcalTarget, keys, meals)`：列出要分析的餐（餐次｜菜名｜份量｜kcal），要求只输出 JSON：
  `{ "meals": { "breakfast": { "protein": 克, "carbs": 克, "fat": 克 } }, "summary": "≤120 字点评", "suggestions": ["≤3 条"] }`
  估算需与每餐 kcal 大致吻合。
- `parseNutrition(raw, keys)`：提取 JSON；每个 key 必须有三项且为 0–300 的数字（四舍五入取 1 位小数），否则抛错；summary 非空字符串；suggestions 取字符串数组前 3 条。调用 `chat(..., { json: true, timeoutMs: 30000 })`。

## UI

- `MacroPie.tsx`：ECharts 环形饼图，三色（蛋白 青 `#22c7e8`、碳水 琥珀 `#f5b544`、脂肪 粉 `#f0609e`），中心显示总 kcal（来自三大营养素换算）。
- `NutritionCard.tsx`（`section.card`）：
  - 标题「🥧 今日营养结构」+ 标签（按计划预览 / 已打卡）+ 按钮「✨ 分析今日饮食 / 重新分析」。
  - 状态：无计划餐（打卡未勾选任何餐）→ 提示；AI 未配置 → 引导去设置；未分析 → 说明 + 按钮；加载中 → spinner；已分析 → 饼图 + 右侧三行评级（克数、占比、参考范围、偏低/合适/偏高标签）+ AI 点评 + 建议 + 每餐营养小表；签名变化 → 顶部提示条。
  - 计划外摄入 >0 时显示旁注。
  - 失败：toast 错误，保留旧结果。
- 样式写在 `src/styles/nutrition.css`，复用 `.card`、`.tag-*`、`.btn`。窄屏饼图与分析上下堆叠。

## 测试

- `nutrition.test.ts`：todayMeals 三种情况、签名变化、sumMacros、macroShares（含全 0）、rateShare 边界、pruneCache。
- `parseNutrition.test.ts`：正常、缺餐、越界、非数字、suggestions 截断。
- `nutritionPrompts.test.ts`：包含餐名与 kcal 目标。
- store：v3 → v4 迁移补 `nutritionCache`。

## 不做

- 不改周表生成/换餐提示词，不给 Meal 增加营养字段。
- 不做历史营养趋势图。
