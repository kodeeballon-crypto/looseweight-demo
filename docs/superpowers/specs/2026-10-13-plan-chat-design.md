# 饮食周表 AI 对话调整 + 生活节奏 设计

日期：2026-10-13
状态：已确认

## 1. 背景与问题

当前 AI 生成的周食谱对上班族不现实：每餐都要精确称重、自己烹饪，工作日早上/晚上根本没时间准备。根因是生成 prompt（`weekPlanMessages`）只知道身体数据和一句偏好，不知道用户的作息和备餐能力，且生成后用户只能逐格“换一个”或手动编辑，无法用自然语言整体调整。

## 2. 目标

1. 在饮食周表右侧加入 AI 对话面板，用户用自然语言描述自身情况，AI 给出**局部修改方案**，预览后一键应用。
2. 对话中提炼出的**长期约束**（记忆）持久保存，并作用于之后的“重新生成本周计划”。
3. 设置页新增**生活节奏**选项，默认上班族；生成 prompt 改为“现实可执行”优先。

非目标：流式输出、多套计划/历史版本、多轮撤销栈、语音输入。

## 3. 数据模型

### 3.1 types.ts 新增

```ts
export type Routine = 'office' | 'student' | 'home' | 'shift';
export type BreakfastMode = 'buy' | 'quick' | 'cook';        // 买现成 / 5 分钟快手 / 能做饭
export type LunchMode = 'takeout' | 'canteen' | 'bento' | 'cook'; // 外卖 / 食堂 / 带饭 / 自己做
export type DinnerMinutes = 0 | 15 | 30 | 60;                // 0=不做饭，60=不限

export interface Lifestyle {
  routine: Routine;
  breakfast: BreakfastMode;
  lunch: LunchMode;
  dinnerMinutes: DinnerMinutes;
}

export const DEFAULT_LIFESTYLE: Lifestyle = { routine: 'office', breakfast: 'quick', lunch: 'takeout', dinnerMinutes: 15 };

// Profile 增加可选字段（旧数据无此字段时按 DEFAULT_LIFESTYLE 处理）
lifestyle?: Lifestyle;

export interface PlanChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;              // ISO
  changeCount?: number;    // assistant 消息附带的改动数（仅展示用）
  applied?: boolean;       // 该条方案是否已应用
}

export interface MealChange {
  weekday: Weekday;
  meal: MealKey;
  next: Meal;
}

export interface PlanAdjustment {
  reply: string;
  changes: MealChange[];
  memoryAdd: string[];
  memoryRemove: string[];
}
```

中文标签常量（`ROUTINE_LABELS` 等）放在 `domain/lifestyle.ts`，同时导出 `lifestyleText(l: Lifestyle): string` 供 prompt 使用。

### 3.2 Store（useStore.ts）

新增持久化字段：
- `planMemory: string[]`：长期约束，最多 12 条，去重（trim 后比较）。
- `planChat: PlanChatMessage[]`：最多保留最近 30 条。

新增 action：
- `appendChat(msg)`、`markChatApplied(id)`、`clearChat()`
- `applyChanges(changes: MealChange[])`：批量合并进 `plan`，未提及的格子不动；`plan` 为空时无操作。
- `updateMemory(add: string[], remove: string[])`、`removeMemory(text)`

`clearAll` 一并清空；`partialize` 加入这两项。persist `version` 升为 2，`migrate` 为旧数据补 `planMemory: []`、`planChat: []`。

纯逻辑函数（便于单测）放在 `domain/planChat.ts`：
- `applyMealChanges(plan, changes): WeekPlan`
- `mergeMemory(current, add, remove): string[]`
- `trimChat(list, max = 30)`

### 3.3 导入导出（dataio.ts）

`ExportData` 增加可选 `planMemory?: string[]`、`planChat?: PlanChatMessage[]`，导入时做类型过滤；缺失则为空数组。`version` 保持 1（字段可选，向后兼容）。`profile.lifestyle` 若存在则校验枚举值，非法则丢弃该字段。

## 4. AI 层

### 4.1 生成 prompt 改造（weekPlanMessages）

签名改为 `weekPlanMessages(profile, currentWeight, kcalTarget, memory: string[])`。

新增段落：
- 【生活节奏】`lifestyleText(profile.lifestyle ?? DEFAULT_LIFESTYLE)`，例如“上班族；工作日早餐买现成的（便利店/早餐铺）；午餐点外卖；晚餐最多 15 分钟快手菜”。
- 【长期要求】逐条列出 `memory`（为空则省略整段）。
- 要求改写：
  - 工作日（周一–周五）严格遵守生活节奏：买现成的早餐写成便利店/早餐铺可买到的组合；外卖/食堂午餐写成可直接点的菜品并给出“选择要点”（如“米饭减半、少油”）；晚餐给出不超过限定时长的做法。
  - 周末可以稍复杂，但单餐备餐不超过 30 分钟（除非 dinnerMinutes=60）。
  - items 份量用生活化单位（一盒、一个、一拳头、半碗）并附大致克数，不要求精确称重。
  - 加餐优先选择可直接买到、无需处理的食物。

### 4.2 对话调整 prompt（新增 adjustPlanMessages）

```ts
adjustPlanMessages(input: {
  profile: Profile; kcalTarget: number; plan: WeekPlan;
  memory: string[]; history: PlanChatMessage[]; userText: string;
}): ChatMessage[]
```

- system：沿用营养师人设 + “只输出合法 JSON”。
- 上下文：个人信息、生活节奏、长期要求、当前周表（紧凑文本：`周一 早餐｜名称｜items｜kcal`，28 行）、最近 6 条对话（按 role 映射为 user/assistant 消息）。
- 要求：
  1. 只修改与用户诉求相关的格子，不相关的不要动；无需修改时 `changes` 为空数组。
  2. 修改后每天总热量保持在目标 ±5% 内（必要时可同时调整当天其他餐来平衡，并在 reply 中说明）。
  3. 如果用户表达了长期适用的约束（如“工作日不做早饭”“不吃牛肉”），写入 `memoryAdd`（每条 ≤ 20 字）；若用户撤销了某条已有约束，写入 `memoryRemove`（原文）。一次性诉求（如“周三聚餐”）不进记忆。
  4. reply 40–120 字，口语化，说明改了什么、为什么。
- 输出 JSON：
  ```json
  { "reply": "...", "changes": [{ "weekday": 1, "meal": "breakfast", "name": "...", "items": "...", "kcal": 400 }], "memoryAdd": [], "memoryRemove": [] }
  ```
- 调用参数：`timeoutMs: 45000, json: true, temperature: 0.6`。

### 4.3 解析（parse.ts 新增 parsePlanAdjustment）

- `reply` 必须为非空字符串，否则 `ParseError`。
- `changes` 非数组视为空；逐条校验：`weekday` 为 1–7 的整数（允许字符串数字）、`meal` ∈ MEAL_KEYS、`normalizeMeal` 通过、`kcal` 在 30–1500 之间；不合法条目丢弃。同一格出现多次取最后一条。
- `memoryAdd/memoryRemove`：过滤为非空字符串，trim，单条截断到 30 字，最多各 5 条。

## 5. UI

### 5.1 布局（MealPlan.tsx + pages.css）

- 有 `plan` 且 AI 已配置时，页面主体改为两栏：`.plan-layout { display:grid; grid-template-columns: minmax(0,1fr) 360px; gap: 20px; }`。左栏为现有统计行 + WeekTable + 本周要点；右栏为 `PlanChat`，`position: sticky; top: 24px; height: calc(100vh - 48px)`。
- `< 1280px`：单栏，`PlanChat` 变为右侧抽屉（`.chat-drawer`，宽 min(400px, 100vw)，玻璃拟态背景，滑入动画），右下角浮动按钮 `#plan-chat-fab`（带未读小圆点：有待确认方案时显示）。
- 无 plan 或未配置 AI 时不显示面板（保持现有引导卡片）。

### 5.2 PlanChat 组件（components/PlanChat.tsx）

结构（自上而下）：
1. 头部：标题“🧑‍🍳 AI 营养师”+ 副标题“说说你的情况，我来调整”+ 清空对话按钮 `#chat-clear`。
2. 记忆条：`planMemory` 渲染为标签 chips（“📌 工作日不做早饭 ×”），点 × 删除；为空时显示淡色提示“我记住的长期要求会显示在这里”。
3. 消息列表：用户气泡右对齐（绿色渐变），AI 气泡左对齐（玻璃卡片）；空状态显示欢迎语 + 示例。新消息自动滚到底部。等待中显示三点跳动动画气泡。
4. 待确认方案卡片（仅最新一条 assistant 消息且有 pending 时）：
   - “将修改 N 餐”，列出每条：`周一·早餐  原名称 → 新名称  (+30 kcal)`。
   - 受影响日的合计变化：`周一 1690 → 1720 kcal`，超出目标 ±5% 时标黄。
   - 按钮：`#chat-apply`「✅ 应用」、`#chat-discard`「放弃」。
5. 快捷短语 chips：“工作日早餐 5 分钟搞定”“午餐只能点外卖”“午餐吃食堂”“晚上不想开火”“预算低一点”“这周有一天聚餐”。点击直接发送。
6. 输入区：自适应高度 textarea `#chat-input`（Enter 发送、Shift+Enter 换行），发送按钮 `#chat-send`；请求中禁用。

Props：`{ variant: 'panel' | 'drawer'; open?: boolean; onClose?: () => void; pending; onPendingChange }`——pending 状态由 MealPlan 持有，以便 WeekTable 同时高亮。

### 5.3 WeekTable 预览高亮

新增可选 prop `preview?: Map<string, Meal>`（key 为 `cellId`）。命中的格子加 `.is-preview`：紫色虚线描边 + 轻微脉冲，格内显示新菜名/新 items/新 kcal，并在左上角显示小标签“待应用”，原菜名以删除线小字显示在下方。合计行按预览后数值计算并标注变化。

### 5.4 交互流程

1. 用户发送 → `appendChat(user)` → 调用 `chat(adjustPlanMessages)` → `parsePlanAdjustment`。
2. 成功：`appendChat(assistant, changeCount)`；`updateMemory(memoryAdd, memoryRemove)` 立即生效（chips 有新增动画）；若 `changes.length > 0` 设置 pending（不持久化）。
3. 「应用」→ `applyChanges` → `markChatApplied` → 清 pending → toast “已更新 N 餐 ✨”。
4. 「放弃」→ 清 pending，消息保留。
5. 发送新消息时若有未应用的 pending，直接丢弃旧 pending（新方案基于当前已生效周表）。
6. 失败：toast 错误，并在列表中插入一条本地错误气泡（不持久化、不发给 AI），用户消息保留可重发；周表不动。
7. 重新生成整周后：清空 pending；对话与记忆保留。

## 6. 设置页：生活节奏

在 `ProfileForm` 的“饮食偏好”上方新增「生活节奏」区块，使用现有 `.segmented` 组件：
- 身份：💼 上班族 / 🎓 学生 / 🏠 居家 / 🌙 倒班
- 早餐：🏪 买现成 / ⚡ 5 分钟快手 / 🍳 能做饭
- 午餐：🛵 外卖 / 🍱 食堂 / 🥡 带饭 / 👩‍🍳 自己做
- 晚餐做饭时间：不做 / 15 分钟 / 30 分钟 / 不限

保存进 `profile.lifestyle`。偏好输入框 placeholder 去掉“工作日午餐点外卖”（已由选项覆盖）。

## 7. 错误处理

| 场景 | 处理 |
|---|---|
| 网络/超时/鉴权错误 | 复用 `chat()` 的 `AiError` 文案，toast + 本地错误气泡 |
| JSON 格式错误 / reply 缺失 | “AI 返回格式不正确，请重试”，同上 |
| changes 全部不合法 | 视为无改动，仅展示 reply |
| localStorage 满 | 沿用 safeStorage 提示；对话上限 30 条控制体积 |

## 8. 测试

- `domain/planChat.test.ts`：`applyMealChanges`（只改指定格、不影响其他、空 plan）、`mergeMemory`（去重、删除、上限 12）、`trimChat`。
- `ai/parse.test.ts` 追加 `parsePlanAdjustment`：合法输出、字符串 weekday、非法 meal/kcal 丢弃、同格去重、缺 reply 抛错、记忆截断。
- `ai/prompts` 测试（新建 `prompts.test.ts`）：`weekPlanMessages` 含生活节奏文本与记忆；无记忆时不含“长期要求”段；`adjustPlanMessages` 包含 28 行周表与用户输入、历史最多 6 条。
- `domain/lifestyle.test.ts`：`lifestyleText` 对默认值与各枚举的输出。
- 手动验证：浏览器中宽屏/窄屏布局、发送 → 预览 → 应用/放弃、记忆 chips 增删、刷新后对话与记忆保留。

## 9. 涉及文件

新增：`src/components/PlanChat.tsx`、`src/domain/planChat.ts`、`src/domain/lifestyle.ts` 及对应测试、`src/ai/prompts.test.ts`
修改：`src/types.ts`、`src/store/useStore.ts`、`src/store/dataio.ts`、`src/ai/prompts.ts`、`src/ai/parse.ts`、`src/pages/MealPlan.tsx`、`src/components/WeekTable.tsx`、`src/components/settings/ProfileForm.tsx`、`src/styles/pages.css`
