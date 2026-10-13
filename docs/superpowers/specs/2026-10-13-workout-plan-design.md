# 训练周表 + AI 教练 + 消耗同步 设计

日期：2026-10-13
状态：待评审

## 1. 背景与目标

目前应用只管“吃”，不管“练”。用户希望：

1. 新增「训练周表」页面，界面与饮食周表一致（左周表 + 右 AI 对话）。
2. 周表记录每天的训练动作，今天的动作可以逐个勾选完成，并可视化今日消耗。
3. 右侧「AI 教练」能生成/调整训练周表，也能回答训练指导问题。
4. 完成的训练消耗同步到首页与统计页，**以红色为主**，让用户一眼看出今天“吃”和“练”的完成情况。

非目标：补勾过去日期、心率/手环接入、动作视频、多套训练计划、流式输出。

## 2. 已确认的决策

| 问题 | 结论 |
|---|---|
| 页面位置 | 左侧导航新增「🏋️ 训练周表」，位于「饮食周表」下方；布局照搬饮食周表页 |
| 热量口径 | **净摄入 = 饮食摄入 − 训练消耗**，首页与统计页用净摄入判定达标；消耗用红色单独展示 |
| 完成粒度 | 按动作勾选，已勾动作的 kcal 累加；另有「一键完成今日训练」；只能勾**今天** |
| 训练条件 | 首次生成前弹出表单（场地/时长/天数/基础/伤病），保存后沿用，可在对话中调整 |
| 实现方式 | 平行新建训练模块，不重构现有饮食代码；复用现有 CSS 类与 `client/extractJson` 等基础设施 |

## 3. 数据模型

### 3.1 types.ts 新增

```ts
export type TrainingPlace = 'home' | 'gym' | 'outdoor';
export type TrainingLevel = 'beginner' | 'base';

export interface TrainingPrefs {
  place: TrainingPlace;
  minutes: 20 | 30 | 45 | 60;   // 每次可用时长
  daysPerWeek: 3 | 4 | 5 | 6 | 7;
  level: TrainingLevel;
  limits: string;               // 伤病/不能做的动作，可为空
}

export interface Exercise {
  id: string;      // 客户端生成，用于勾选
  name: string;    // 快走 / 深蹲
  detail: string;  // "30 分钟" / "4 组 × 12 次" / 要点
  kcal: number;    // 10–800 整数
}

export interface WorkoutDay {
  weekday: Weekday;
  focus: string;          // "下肢力量" / "有氧燃脂" / "休息·拉伸"
  exercises: Exercise[];  // 训练日 2–5 个；休息日 0–2 个轻量动作
}

export interface WorkoutPlan {
  createdAt: string;
  days: WorkoutDay[];     // 正好 7 天
  tips?: string[];
}

/** 当日已完成动作的快照：勾选时记录 name/kcal，之后改周表不影响历史 */
export interface DoneExercise { id: string; name: string; kcal: number }
export type WorkoutLog = Record<string /* YYYY-MM-DD */, DoneExercise[]>;

export interface WorkoutChange { weekday: Weekday; next: WorkoutDay }  // 以“整天”为粒度
export interface WorkoutAdjustment { reply: string; changes: WorkoutChange[]; memoryAdd: string[]; memoryRemove: string[] }
```

对话消息直接复用 `PlanChatMessage` 类型。

### 3.2 纯逻辑（domain/workout.ts，全部单测）

- `PLACE_LABELS / LEVEL_LABELS / DEFAULT_PREFS`（默认：居家、30 分钟、每周 4 天、新手、无限制）、`prefsText(p): string`、`isPrefs(v)`。
- `burnedOn(log, date): number` —— 当日已完成动作 kcal 之和。
- `toggleDone(log, date, ex): WorkoutLog` —— 已勾则取消，未勾则加入快照；当日为空时删除该日期键。
- `completeAll(log, date, exercises): WorkoutLog` —— 把当天所有未勾动作加入。
- `dayBurn(day): number`、`weekBurn(plan): number` —— 计划消耗。
- `applyWorkoutChanges(plan, changes): WorkoutPlan` —— 整天替换，其它天保持原引用。
- `netIntake(intake, burned) = max(0, intake − burned)`。

### 3.3 calc.ts 改动（向后兼容）

- `computeStats(profile, records, plan, target, log: WorkoutLog = {})`：达标率改为按 `netIntake(intakeOf(r).kcal, burnedOn(log, r.date))` 判定；不传 log 时行为与现在一致（现有测试不变）。

### 3.4 Store（useStore.ts）

新增持久化字段：`trainingPrefs: TrainingPrefs | null`、`workoutPlan: WorkoutPlan | null`、`workoutLog: WorkoutLog`、`workoutChat: PlanChatMessage[]`（≤30）、`workoutMemory: string[]`（≤12）。

新增 action：`setTrainingPrefs`、`setWorkoutPlan`、`updateWorkoutDay(weekday, day)`、`updateExercise(weekday, id, ex)`、`applyWorkoutChanges(changes)`、`toggleExercise(date, ex)`、`completeToday(date, exercises)`、`appendWorkoutChat`、`markWorkoutChatApplied`、`clearWorkoutChat`、`updateWorkoutMemory`、`removeWorkoutMemory`。

`clearAll` 一并清空；`partialize` 加入新字段；persist `version` 升为 3，`migrate` 为旧数据补默认值（`null / {} / []`）。

### 3.5 导入导出（dataio.ts）

`ExportData` 增加可选 `trainingPrefs / workoutPlan / workoutLog / workoutChat / workoutMemory`。导入时：prefs 不合法则为 null；workoutPlan 必须 7 天且每个动作 name 非空、kcal 合法，否则报错“训练计划数据不完整”；workoutLog 只保留合法日期键与合法条目；chat/memory 复用现有过滤。`version` 保持 1。

## 4. AI 层

### 4.1 生成训练周表 `workoutPlanMessages(profile, weightKg, prefs, memory)`

- system：“你是一名持证健身教练，擅长为减脂人群设计安全、循序渐进、可在家/健身房/户外完成的训练计划。只输出合法 JSON。”
- 上下文：性别、年龄、身高、当前体重、BMI、目标体重、`prefsText(prefs)`、【长期要求】（为空省略）。
- 要求：
  1. 7 天中安排 `daysPerWeek` 个训练日，其余为休息日（focus 写“休息”或“休息·拉伸”，exercises 0–2 个轻量动作）。
  2. 训练日 2–5 个动作，单日总时长不超过 `minutes` 分钟；力量与有氧交替，避免同一肌群连续两天。
  3. 动作必须适配场地；新手选低冲击、易掌握的动作；严格避开 limits 中提到的部位/动作。
  4. detail 写组数×次数或时长，并附一句要点（如“膝盖不超过脚尖”）。
  5. kcal 按当前体重估算该动作的消耗，整数，单个 10–800。
  6. tips 3 条以内。days 必须 7 项，weekday 1–7。
- 输出：`{ "days": [{ "weekday": 1, "focus": "...", "exercises": [{ "name": "...", "detail": "...", "kcal": 120 }] }], "tips": [] }`
- 调用：`timeoutMs: 60000, json: true`。

### 4.2 换一个动作 `replaceExerciseMessages(profile, prefs, day, exercise)`

热量在原值 ±20% 内、与当天其他动作不重复、符合场地/基础/限制。输出 `{ name, detail, kcal }`。`timeoutMs: 20000`。

### 4.3 对话 `adjustWorkoutMessages({ profile, weightKg, prefs, plan, memory, history, userText })`

- system：教练人设 + “你也会回答用户关于动作要领、训练安排、酸痛恢复等问题”。
- 上下文：个人信息、训练条件、长期要求、当前周表（紧凑文本：`周一｜下肢力量｜深蹲｜4组×12次｜60`）、最近 6 条对话。
- 要求：
  1. 用户只是提问/求指导时 `changes` 为空数组，reply 直接给出指导（≤200 字）。
  2. 需要改周表时，以“整天”为单位给出修改后的完整一天（focus + exercises），只改相关的天。
  3. 长期约束（如“膝盖不好”“只有哑铃”）写入 memoryAdd（≤20 字）；撤销的写 memoryRemove；一次性情况不进记忆。
  4. 不给医疗诊断；涉及疼痛/伤病时提醒就医。
- 输出：`{ "reply": "...", "changes": [{ "weekday": 3, "focus": "...", "exercises": [...] }], "memoryAdd": [], "memoryRemove": [] }`
- 调用：`timeoutMs: 45000, json: true, temperature: 0.6`。

### 4.4 解析（ai/parseWorkout.ts，全部单测）

- `normalizeExercise(raw)`：name 非空、kcal 为 10–800 的数（允许字符串数字，四舍五入），detail 缺省为空串；生成新 id。
- `parseWorkoutPlan(text, now)`：至少 7 天；每天 focus 缺省为“训练”，exercises 中不合法条目丢弃；训练日（非“休息”）若一个合法动作都没有则 `ParseError`。tips 最多 3 条。
- `parseExercise(text)`：兼容 `{exercise:{...}}` 包裹。
- `parseWorkoutAdjustment(text)`：reply 必填；changes 逐条校验 weekday 与动作，同一天取最后一条；记忆列表复用现有规则（单条 30 字、最多 5 条）。

## 5. UI

### 5.1 导航与路由

`App.tsx` NAV 在「饮食周表」后插入 `{ to: '/workout', ico: '🏋️', label: '训练周表' }`，新增路由 `/workout → <Workout />`。窄屏底部 tabbar 同步显示（5 个）。

### 5.2 训练周表页（pages/Workout.tsx）

结构与 MealPlan 一致：

1. **page-head**：标题「AI 训练周表」，副标题「跟着练就好 · 勾选今天完成的动作，消耗自动同步到首页」；右上按钮「✨ 生成我的训练计划 / 重新生成本周训练」（重新生成需确认）；旁边小按钮「⚙️ 训练条件」可随时打开表单。
2. **未配置 AI / 未生成**：沿用 `guide-card` 样式的引导卡片。
3. **统计行（plan-head）**，以红色为主：
   - 「今日已消耗」：红色小环（ECharts，`BurnRing`）显示 已消耗 / 今日计划，中间数字。
   - 「今日完成」：`2 / 4 个动作`。
   - 「本周计划消耗」：`weekBurn` kcal。
   - 「生成时间」。
4. **WorkoutTable**（components/WorkoutTable.tsx）：沿用 `.week` 网格，7 列；
   - 表头：周几 + 今天显示 TODAY 标记，副标题显示当天 focus。
   - 单行「🏋️ 训练」：每格列出动作卡片（名称、detail、红色 `kcal` 标签）；休息日整体淡化并显示 😴。
   - 今天这一列的每个动作前有圆形勾选框，勾选后卡片变为红色描边 + ✓，名称不划线；列底部有 `#workout-complete-all`「🔥 一键完成今日训练」（全部完成后变为「✅ 今日训练已完成」，禁用）。
   - 非今天的列不可勾选。
   - 点格子空白处 → 编辑当天（WorkoutDayModal：focus、动作列表可改名称/detail/kcal、增删动作）；悬停动作显示「🔄 换一个」（AI 已配置时）。
   - 底部合计行：当天计划消耗（红色字），今天列显示 `已消耗 / 计划`。
   - 预览：`preview?: Map<Weekday, WorkoutDay>`，命中的列加 `.is-preview`（紫色虚线 + “待应用”），显示新内容。
5. **本周要点** tips 卡片。
6. **右侧 WorkoutChat**（components/WorkoutChat.tsx）：复用 `plan-chat` 系列 CSS；头像 🏋️，标题「AI 教练」，副标题「调整计划，或问我动作怎么做」；记忆 chips；待确认卡片按天列出 `周三 下肢力量 → 有氧+核心（+40 kcal）`；快捷短语：「膝盖不太好」「只有一副哑铃」「这周很忙，每次 20 分钟」「深蹲怎么做才标准？」「练完很酸怎么办」「今天想换成有氧」。宽屏右栏、窄屏抽屉 + `#workout-chat-fab`，与 MealPlan 相同的断点（1440px）。
7. **TrainingPrefsModal**：五项用现有 `.segmented`，限制项为 textarea；首次点击生成且 `trainingPrefs` 为空时自动弹出，保存后直接开始生成。

### 5.3 首页（Dashboard）

- **今日热量卡**：`KcalRing` 增加可选 `burned` / `burnPlan` 属性：
  - 外圈：净摄入 / 目标（原配色逻辑，按净摄入判定状态）。
  - 内圈（新）：红色渐变 `#ff4d6d → #ff8e5e`，已消耗 / 今日计划消耗（无计划时按已消耗 / 300 显示）。
  - 中心大字为净摄入；图例改为四项：摄入、**🔴 训练消耗**、净摄入、目标。
  - 没有训练计划且没有消耗时，外观与现在完全一致。
- **新增「今日完成情况」卡**（放在今日热量卡下方）：
  - 🥗 饮食：已勾 `n / 4` 餐，绿色进度条。
  - 🏋️ 训练：已完成 `n / m` 个动作 · `xxx kcal`，**红色**进度条；休息日显示“今天休息 😴”；无计划显示「去生成训练计划 →」。
  - 两项都完成时卡片顶部显示「🎉 今日饮食与训练全部完成」。
- 状态标签与达标判定改用净摄入。

### 5.4 统计页（Stats）

- **每日热量图**（`KcalChart` 增加 `log` 参数）：
  - x 轴为“有饮食数据或有消耗”的日期并集（范围内）。
  - 摄入柱（按净摄入状态着色，含义不变）+ **红色消耗柱**（同组并列）+ 净摄入折线（白色细线、圆点）。
  - 副标题改为「柱：摄入 / 🔴 训练消耗 · 线：净摄入」。
- **热量达标率**卡改用净摄入（`computeStats` 传入 log），foot 文案「按净摄入统计」。
- **历史记录表**新增「训练消耗」列，红色数字（无则 “—”）；「摄入」列后显示净摄入小字。

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| 网络/超时/鉴权 | 复用 `errorMessage`，toast；对话里插本地错误气泡；周表不动 |
| 生成返回格式错 | “AI 返回格式不正确，请重试”，保留原计划 |
| 动作 kcal 超范围 | 丢弃该动作；训练日全部丢弃时视为格式错误 |
| 重新生成 | 清空待确认方案；今日已完成记录保留（仍计入消耗），新表中不再显示勾选 |
| 编辑/删除已勾选动作 | 已完成快照不变（消耗仍计入）；若该动作被删除，今日列底部显示「另有 n 个已完成动作 · x kcal」 |
| 跨天 | `todayStr()` 每次渲染计算，零点后自动切到新的一天 |
| localStorage 满 | 沿用 safeStorage 提示 |

## 7. 测试

- `domain/workout.test.ts`：`burnedOn`、`toggleDone`（勾/取消/删空键）、`completeAll`（不重复）、`dayBurn/weekBurn`、`applyWorkoutChanges`（只改指定天、原引用不变）、`netIntake`（不为负）、`prefsText`。
- `ai/parseWorkout.test.ts`：合法计划、字符串 kcal、超范围动作丢弃、训练日无动作抛错、休息日允许空、tips 截断、`parseExercise` 包裹、`parseWorkoutAdjustment` 去重/缺 reply 抛错/纯问答 changes 为空。
- `ai/prompts.test.ts` 追加：生成 prompt 含训练条件与限制、无记忆不含“长期要求”；对话 prompt 含周表文本、历史最多 6 条。
- `domain/calc.test.ts` 追加：`computeStats` 传入 log 后达标率按净摄入计算。
- `store/useStore.test.ts` 追加：v2 数据迁移到 v3 后新字段有默认值；勾选写入 localStorage 并在重新加载后保留。
- `store/dataio` 导入：合法/非法训练数据。
- 手动：宽/窄屏布局、生成 → 勾选 → 首页红圈与完成卡同步 → 统计页红柱、对话问答与调整预览/应用。

## 8. 涉及文件

新增：`src/pages/Workout.tsx`、`src/components/WorkoutTable.tsx`、`src/components/WorkoutChat.tsx`、`src/components/WorkoutDayModal.tsx`、`src/components/TrainingPrefsModal.tsx`、`src/components/BurnRing.tsx`、`src/components/TodayProgress.tsx`、`src/domain/workout.ts`、`src/ai/parseWorkout.ts`、`src/ai/workoutPrompts.ts` 及对应测试、`src/styles/workout.css`

修改：`src/types.ts`、`src/store/useStore.ts`、`src/store/dataio.ts`、`src/domain/calc.ts`、`src/components/KcalRing.tsx`、`src/components/Charts.tsx`、`src/pages/Dashboard.tsx`、`src/pages/Stats.tsx`、`src/App.tsx`、`src/main.tsx`（引入 workout.css）、`src/components/settings/DataManage.tsx`（导出新字段、清空文案）、`README.md`
