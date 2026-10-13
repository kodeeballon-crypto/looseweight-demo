# 训练周表 + AI 教练 + 消耗同步 Implementation Plan

> **For agentic workers:** 按任务顺序执行，每个任务先写测试（TDD），通过后提交。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增训练周表页（左周表 + 右 AI 教练），今日勾选的训练消耗以红色同步到首页与统计页，按净摄入判定达标。

**Architecture:** 平行于饮食周表新建训练模块：纯逻辑在 `domain/workout.ts`，AI 在 `ai/workoutPrompts.ts` + `ai/parseWorkout.ts`，状态进 zustand 持久化 store（version 3），UI 复用现有 `.week` / `plan-chat` 样式，新增 `styles/workout.css`。

**Tech Stack:** React 19 + TypeScript + zustand persist + ECharts + Vitest

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-10-13-workout-plan-design.md`（以其为准）
- 单个动作 kcal：AI 输出须在 10–800；手动编辑允许 1–2000
- 净摄入 = `max(0, 摄入 − 消耗)`；只能勾选今天
- 红色主色：`#ff4d6d → #ff8e5e` 渐变
- 每个任务结束：`npx vitest run` 与 `npx tsc --noEmit -p .` 均通过后再 `git commit`
- 不新增依赖

---

### Task 1: 类型 + 训练纯逻辑

**Files:** Modify `src/types.ts`；Create `src/domain/workout.ts`、`src/domain/workout.test.ts`

**Produces:**
- types：`TrainingPlace`、`TrainingLevel`、`TrainingMinutes`、`TrainingDays`、`TrainingPrefs`、`Exercise`、`WorkoutDay`、`WorkoutPlan`、`DoneExercise`、`WorkoutLog`、`WorkoutChange`、`WorkoutAdjustment`
- `PLACE_LABELS`、`LEVEL_LABELS`、`MINUTE_OPTIONS`、`DAY_OPTIONS`、`DEFAULT_PREFS`
- `prefsText(p): string`、`isPrefs(x): x is TrainingPrefs`、`isRestDay(d): boolean`
- `dayBurn(d)`、`weekBurn(p)`、`burnedOn(log, date)`、`toggleDone(log, date, ex)`、`completeAll(log, date, exs)`、`applyWorkoutChanges(plan, changes)`、`netIntake(intake, burned)`、`exerciseId()`

**Tests（workout.test.ts）:**
- `burnedOn` 累加当天快照；无记录为 0
- `toggleDone` 勾选写入 `{id,name,kcal}` 快照；再次调用取消；当天清空时删除日期键；不修改原对象
- `completeAll` 只追加未勾选的，不重复；全部已勾时返回原对象
- `dayBurn` / `weekBurn` 求和
- `applyWorkoutChanges` 只替换指定天，其它天保持原引用；空改动返回原计划
- `netIntake(1500, 300) === 1200`，`netIntake(200, 500) === 0`
- `prefsText` 包含场地、时长、天数、限制（空时为“无”）
- `isPrefs` 合法/非法枚举
- `isRestDay` 依据 focus 含“休息”

- [ ] 写测试 → 运行失败 → 实现 → 通过 → `git commit -m "feat: workout types and domain helpers"`

### Task 2: 统计按净摄入

**Files:** Modify `src/domain/calc.ts`（`computeStats` 增加 `log: WorkoutLog = {}`）；Test `src/domain/calc.test.ts`

**Tests:** 一条摄入 2000（target 1800）记录：不传 log 达标率 0；传入当天消耗 300 的 log 后达标率 1。原有用例不变。

- [ ] 写测试 → 失败 → 实现 → 通过 → commit `feat: kcal ok-rate uses net intake`

### Task 3: AI 解析

**Files:** Modify `src/ai/parse.ts`（导出 `toWeekday`、`toStrList`）；Create `src/ai/parseWorkout.ts`、`src/ai/parseWorkout.test.ts`

**Produces:** `normalizeExercise(raw, id?)`、`parseWorkoutPlan(text, now?)`、`parseExercise(text)`、`parseWorkoutAdjustment(text)`；常量 `EX_KCAL_MIN = 10`、`EX_KCAL_MAX = 800`

**Tests:** 合法 7 天计划（含 tips 截断到 3 条）；字符串 kcal；超范围动作被丢弃；训练日动作全不合法抛 `ParseError`；休息日允许空；不足 7 天抛错；每个动作有唯一 id；`parseExercise` 兼容 `{exercise:{}}`；`parseWorkoutAdjustment` 缺 reply 抛错、纯问答 changes 为空、同一天取最后一条、非法 weekday 丢弃、记忆截断。

- [ ] 写测试 → 失败 → 实现 → 通过 → commit `feat: parse workout plan and adjustments`

### Task 4: AI 提示词

**Files:** Create `src/ai/workoutPrompts.ts`、`src/ai/workoutPrompts.test.ts`

**Produces:** `workoutPlanMessages(profile, weightKg, prefs, memory?)`、`replaceExerciseMessages(profile, prefs, day, ex)`、`workoutToText(plan)`、`adjustWorkoutMessages({ profile, weightKg, prefs, plan, memory, history, userText })`

**Tests:** 生成 prompt 含 `prefsText` 与训练天数、有记忆时含“【长期要求】”，无记忆时不含；`workoutToText` 每个动作一行、休息日空动作输出“（无动作）”；对话 prompt 首条 system、末条含用户输入与周表，历史最多 6 条；换动作 prompt 含原动作名与热量区间。

- [ ] 写测试 → 失败 → 实现 → 通过 → commit `feat: workout prompts`

### Task 5: Store 与导入导出

**Files:** Modify `src/store/useStore.ts`、`src/store/dataio.ts`、`src/components/settings/DataManage.tsx`；Test `src/store/useStore.test.ts`、Create `src/store/dataio.test.ts`

**Produces（store）:** 字段 `trainingPrefs`、`workoutPlan`、`workoutLog`、`workoutChat`、`workoutMemory`；action `setTrainingPrefs`、`setWorkoutPlan`、`updateWorkoutDay(w, day)`、`updateExercise(w, id, ex)`、`applyWorkoutChanges(changes)`、`toggleExercise(date, ex)`、`completeToday(date, exs)`、`appendWorkoutChat`、`markWorkoutChatApplied`、`clearWorkoutChat`、`updateWorkoutMemory`、`removeWorkoutMemory`；persist version 3。

**Tests:** v2 数据加载后新字段为默认值且旧数据保留；勾选后重新加载仍在；`clearAll` 清空训练数据；dataio 导入合法训练数据、非法 prefs 置 null、训练计划缺天报错、workoutLog 过滤非法日期与条目。

- [ ] 写测试 → 失败 → 实现 → 通过 → commit `feat: persist workout state, import/export`

### Task 6: 训练周表页（周表、弹窗、样式、路由）

**Files:** Create `src/hooks/useWide.ts`、`src/components/BurnRing.tsx`、`src/components/TrainingPrefsModal.tsx`、`src/components/WorkoutDayModal.tsx`、`src/components/WorkoutTable.tsx`、`src/pages/Workout.tsx`、`src/styles/workout.css`；Modify `src/pages/MealPlan.tsx`（改用 `useWide`）、`src/App.tsx`（导航 + 路由）、`src/main.tsx`（引入 css）

要点见设计文档 §5.1–5.2：统计行红色环、今天列勾选与一键完成、编辑当天、换一个动作、首次生成弹训练条件表单、重新生成二次确认、已完成但已移出周表的动作提示。

- [ ] 实现 → `tsc` + `vitest` 通过 → commit `feat: workout week page`

### Task 7: AI 教练对话

**Files:** Create `src/components/WorkoutChat.tsx`；Modify `src/pages/Workout.tsx`、`src/components/WorkoutTable.tsx`（预览）

要点见设计文档 §5.2-6：问答不改表；按天预览/应用/放弃；记忆 chips；快捷短语；宽屏面板 / 窄屏抽屉 `#workout-chat-fab`。

- [ ] 实现 → 检查通过 → commit `feat: AI coach chat for workout plan`

### Task 8: 首页同步

**Files:** Modify `src/components/KcalRing.tsx`（可选 `burned`、`burnPlan` 内圈红环）、`src/pages/Dashboard.tsx`；Create `src/components/TodayProgress.tsx`

- [ ] 实现 → 检查通过 → commit `feat: dashboard shows training burn and today progress`

### Task 9: 统计页同步

**Files:** Modify `src/components/Charts.tsx`（`KcalChart` 增加 `log`：红色消耗柱 + 净摄入折线）、`src/pages/Stats.tsx`（达标率传 log、表格增加训练消耗列）

- [ ] 实现 → 检查通过 → commit `feat: stats include training burn`

### Task 10: 文档与验收

**Files:** Modify `README.md`

- [ ] README 增加训练周表说明
- [ ] `npx vitest run`、`npx tsc --noEmit -p .`、`npm run build` 全部通过
- [ ] commit `docs: workout plan usage`
