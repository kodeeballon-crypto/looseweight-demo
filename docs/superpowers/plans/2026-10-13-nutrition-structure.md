# 今日营养结构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 饮食周表页新增「🥧 今日营养结构」卡片：三大营养素饼图 + 本地评级 + AI 点评。

**Architecture:** 新增独立模块 `domain/nutrition`（纯函数）、`ai/nutritionPrompts` + `ai/parseNutrition`（AI 估算）、store `nutritionCache`（persist v4），UI 组件 `MacroPie` + `NutritionCard` 挂到 `MealPlan` 页。

**Tech Stack:** React 19 + TS + zustand persist + ECharts + Vitest。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-13-nutrition-structure-design.md`
- 不新增依赖；不改周表生成/换餐提示词；不给 `Meal` 加字段。
- 参考范围：蛋白 25–35%、碳水 40–50%、脂肪 20–30%（含边界为 ok）。
- 每餐克数 0–300（保留 1 位小数）；suggestions ≤3；缓存保留 14 天；不进入导出。
- 颜色：蛋白 `#22c7e8`、碳水 `#f5b544`、脂肪 `#f0609e`。
- 中文 UI；保留已有注释。

---

### Task 1: 类型 + `domain/nutrition.ts`

**Files:** Modify `src/types.ts`；Create `src/domain/nutrition.ts`、`src/domain/nutrition.test.ts`

**Produces:**
- types：`MacroKind = 'protein'|'carbs'|'fat'`、`Macros`、`NutritionAnalysis`、`NutritionCache`（字段见规格）。
- `MACRO_KINDS`、`MACRO_LABELS`、`MACRO_COLORS`、`MACRO_RANGE: Record<MacroKind,[number,number]>`
- `todayMeals(plan: WeekPlan|null, record: DailyRecord|undefined, weekday: Weekday): { keys: MealKey[]; meals: Partial<Record<MealKey, Meal>>; preview: boolean }`
- `mealSignature(keys, meals): string`
- `sumMacros(a: NutritionAnalysis, keys: MealKey[]): Macros`
- `macroKcal(m: Macros): Record<MacroKind, number>` 与 `macroShares(m): Record<MacroKind, number>`（整数 %）
- `rateShare(kind, pct): 'low'|'ok'|'high'`
- `pruneCache(cache, keep = 14): NutritionCache`

- [ ] 写测试：todayMeals（无计划 / 未打卡预览 4 餐 / 已打卡只取 mealsEaten 并按 MEAL_KEYS 排序）、签名随菜名或 keys 变化、sumMacros 只累加 keys、macroShares（P30 C50 F20 g → 蛋白 24 碳水 40 脂肪 36；全 0 → 全 0）、rateShare 边界（25 ok、24.9 low、35.1 high）、pruneCache 保留最新 14 天。
- [ ] `npx vitest run src/domain/nutrition.test.ts` → FAIL
- [ ] 实现 → PASS
- [ ] commit `feat: nutrition domain`

### Task 2: AI 提示词 + 解析

**Files:** Create `src/ai/nutritionPrompts.ts`、`src/ai/nutritionPrompts.test.ts`、`src/ai/parseNutrition.ts`、`src/ai/parseNutrition.test.ts`

**Consumes:** `extractJson`、`ParseError`（`ai/parse`）、`ChatMessage`（`ai/client`）
**Produces:**
- `nutritionMessages(profile: Profile, kcalTarget: number, keys: MealKey[], meals: Partial<Record<MealKey, Meal>>): ChatMessage[]`
- `parseNutrition(text: string, keys: MealKey[]): { meals: Partial<Record<MealKey, Macros>>; summary: string; suggestions: string[] }`

- [ ] 测试 prompts：user 消息包含每餐名称、kcal、热量目标；system 要求只输出 JSON。
- [ ] 测试 parse：正常；缺某餐 → 抛 ParseError；克数 301 / -1 / "abc" → 抛；字符串数字 "20.25" → 20.3；summary 为空 → 抛；suggestions 5 条 → 3 条。
- [ ] FAIL → 实现 → PASS
- [ ] commit `feat: nutrition AI prompt and parser`

### Task 3: Store v4

**Files:** Modify `src/store/useStore.ts`；Test `src/store/persist.test.ts`（已有则追加）

**Produces:** state `nutritionCache: NutritionCache`；action `setNutrition(a: NutritionAnalysis): void`（写入后 `pruneCache`）。persist `version: 4`，migrate 补 `nutritionCache`（非对象 → `{}`），partialize 加入；`clearAll`、`importData` 置 `{}`。

- [ ] 测试：setNutrition 写入并裁剪到 14 天；migrate 旧状态无 nutritionCache → `{}`。
- [ ] FAIL → 实现 → PASS
- [ ] commit `feat: store nutrition cache (persist v4)`

### Task 4: UI

**Files:** Create `src/components/MacroPie.tsx`、`src/components/NutritionCard.tsx`、`src/styles/nutrition.css`；Modify `src/pages/MealPlan.tsx`（WeekTable 后插入 `<NutritionCard />`）、`src/main.tsx`（import css）

**Consumes:** Task 1–3 全部导出；`chat`、`errorMessage`、`isAiConfigured`；`energyInfo`、`weekdayOf`、`todayStr`；`toast`。

- MacroPie：`{ macros: Macros }`，环形饼图，中心显示换算 kcal。
- NutritionCard 状态：无计划餐 → 提示；AI 未配置 → 引导；未分析 → 按钮；加载中；已分析 → 饼图 + 三行评级 + 点评 + 建议 + 每餐小表；签名变化 → 提示条；extraKcal>0 → 旁注；失败 → toast 保留旧结果。
- [ ] 实现；`npx tsc --noEmit -p .` 通过
- [ ] commit `feat: nutrition structure card on meal plan`

### Task 5: 文档与验证

- [ ] README 使用流程第 2 步补充营养结构；目录补充 `nutrition`。
- [ ] `npx vitest run`、`npx tsc --noEmit -p .`、`npm run build` 全部通过
- [ ] commit `docs: nutrition structure usage`
