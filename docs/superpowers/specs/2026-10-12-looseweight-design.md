# 减重记录 Web 应用（looseweight-demo）设计文档

日期：2026-10-12
状态：待用户审阅

## 1. 目标

个人自用的减重 Web 应用，核心解决三件事：

1. **记录体重**：每天输入体重，自动生成可视化图表与统计。
2. **不纠结吃什么**：AI 根据身高/体重/性别等生成针对性的一周饮食计划，以醒目的周表展示。
3. **坚持下去**：打卡后自动计算当日热量摄入，并给予鼓励和情绪价值。

非目标（YAGNI，本期不做）：多设备同步、账号系统、后端服务、食物热量数据库手动搜索、运动记录、腰围/体脂记录。

## 2. 技术方案

| 项 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite | 启动快；dev server 代理解决 AI 接口 CORS |
| 框架 | React 18 + TypeScript | 类型安全，组件化 |
| 图表 | ECharts（echarts-for-react） | 中文友好，折线/面积/标记线完善 |
| 路由 | react-router-dom（HashRouter） | 4 个页面，Hash 模式无需服务端配置 |
| 状态 | Zustand + persist 中间件 → localStorage | 轻量，持久化开箱即用 |
| 日期 | dayjs | 轻量 |
| 测试 | Vitest | 与 Vite 集成，测试计算逻辑 |
| 样式 | 原生 CSS（CSS 变量 + 模块化文件） | 无额外依赖，便于定制醒目配色 |

运行方式：`npm install` → `npm run dev`，浏览器打开 `http://localhost:5173`。

### CORS 处理

- 开发模式下，前端请求统一发往 `/ai-proxy/*`，Vite 读取请求头 `x-target-base`（用户在设置页填写的 Base URL）动态转发到真实 AI 服务。
- 实现方式：在 `vite.config.ts` 中写一个小型自定义中间件插件（`configureServer`），用 Node 原生 `fetch` 转发请求，避免把 Base URL 写死在配置里。
- 设置页提供“直连模式”开关（默认关）：对支持 CORS 的服务可不经代理直接请求。

## 3. 模块划分

```
src/
  domain/            纯函数，无 UI 依赖，全部单测覆盖
    calc.ts          BMI、BMR、TDEE、热量目标、7 日均线、统计
    encourage.ts     离线鼓励语选择（按场景）
    badges.ts        连续打卡、里程碑判定
  ai/
    client.ts        OpenAI 兼容 chat/completions 调用（含超时、错误归一化）
    prompts.ts       周食谱 / 单餐替换 / 鼓励 三套提示词
    parse.ts         从模型输出提取并校验 JSON（容错 ```json 包裹）
  store/
    useStore.ts      Zustand store：profile / records / plan / settings
  pages/
    Dashboard.tsx    首页：今日打卡 + 今日菜单 + 鼓励卡片 + 关键指标
    Stats.tsx        统计：图表 + 历史表格
    MealPlan.tsx     AI 饮食周表
    Settings.tsx     档案、AI 配置、导入导出
  components/        通用组件（指标卡、进度条、徽章、周表单元格等）
  App.tsx / main.tsx
vite.config.ts       含 AI 代理中间件
```

边界原则：`domain/` 与 `ai/parse.ts` 不依赖 React，可独立测试；页面只通过 store 与 domain 交互。

## 4. 数据模型（localStorage，key：`looseweight-v1`）

```ts
type Sex = 'male' | 'female';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active'; // 系数 1.2/1.375/1.55/1.725

interface Profile {
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  sex: Sex;
  age: number;
  activity: Activity;
  startDate: string;        // YYYY-MM-DD
  preferences?: string;     // 饮食偏好/忌口，传给 AI，如“不吃香菜，爱吃面食”
}

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface DailyRecord {
  date: string;             // YYYY-MM-DD，唯一
  weightKg: number;
  mealsEaten: MealKey[];    // 按计划吃了的餐次
  extraKcal?: number;       // 计划外摄入（可选，快速填写：如“奶茶 +300”）
  encouragement?: string;   // 当天生成的鼓励语（缓存，避免重复调用）
}

interface Meal {
  name: string;             // 菜名，如“鸡胸肉藜麦饭”
  items: string;            // 份量说明，如“鸡胸肉150g、藜麦饭100g、西兰花200g”
  kcal: number;
}

interface DayPlan {
  weekday: 1|2|3|4|5|6|7;   // 周一=1
  meals: Record<MealKey, Meal>;
}

interface WeekPlan {
  createdAt: string;
  dailyKcalTarget: number;
  days: DayPlan[];          // 长度 7
  tips?: string[];          // AI 给的本周要点（3 条以内）
}

interface Settings {
  baseUrl: string;          // 例 https://api.deepseek.com/v1
  apiKey: string;
  model: string;            // 例 deepseek-chat
  directMode: boolean;      // 默认 false（走 Vite 代理）
}
```

## 5. 计算规则（domain/calc.ts）

- **BMI** = 体重kg / (身高m)²；分级（中国标准）：<18.5 偏瘦，18.5–23.9 正常，24–27.9 超重，≥28 肥胖。
- **BMR**（Mifflin-St Jeor）：男 10w + 6.25h − 5a + 5；女 10w + 6.25h − 5a − 161。使用**最新一次记录体重**。
- **TDEE** = BMR × 活动系数。
- **每日热量目标** = max(TDEE − 500, 安全下限)，安全下限：男 1500、女 1200 kcal。
- **当日摄入** = Σ(当天周计划中被勾选餐次的 kcal) + extraKcal。
  当天无周计划时只统计 extraKcal，并提示“先生成饮食计划”。
- **热量状态**：摄入 ≤ 目标 → 达标；目标 < 摄入 ≤ 目标×1.1 → 略超；更高 → 超标。
- **7 日均线**：每个有记录的日期，取该日及之前 6 天内所有记录的平均值。
- **统计**：累计减重 = 初始 − 最新；目标进度 = 累计减重 / (初始 − 目标)，截断到 0–100%；近 7 天变化；平均周减重；热量达标率 = 达标天数 / 有打卡天数。

## 6. 页面设计

### 6.1 首次使用引导
未填写档案时，任意页面重定向到设置页的档案表单，填写后进入首页。

### 6.2 首页 Dashboard
- **顶部指标卡**（4 张）：当前体重、累计减重、BMI（带分级色）、连续打卡天数 🔥。
- **今日打卡卡片**：体重输入框；今日菜单 4 餐复选框（显示菜名与 kcal）；计划外摄入输入；“打卡”按钮。已打卡则显示为可编辑状态。
- **今日热量环形图**：摄入 / 目标，颜色随状态绿/黄/红。
- **鼓励卡片**：打卡后显示鼓励语（见第 8 节），配表情与徽章解锁提示。
- **目标进度条**：初始 → 当前 → 目标。

### 6.3 统计 Stats
- 体重趋势图：每日体重散点+折线、7 日均线（粗线）、目标体重标记线；可切换 30 天 / 90 天 / 全部。
- 每日热量柱状图：摄入柱 + 目标线，柱子按状态着色。
- 统计数字卡：近 7 天变化、平均周减重、热量达标率、预计达成日期（按近 4 周平均速度线性外推，速度 ≤0 时显示“继续加油”）。
- 历史记录表格：日期、体重、较前一次变化（↓绿 ↑红）、BMI、摄入 kcal、状态；支持编辑、删除（删除需确认）。

### 6.4 AI 饮食周表 MealPlan
- 头部：每日热量目标、生成时间、“重新生成本周计划”按钮（二次确认）。
- **周表**：行 = 早餐/午餐/晚餐/加餐，列 = 周一…周日；**今天所在列高亮**（醒目边框+底色）；每格显示菜名（大字）、份量（小字）、kcal 标签；底部一行显示每日合计 kcal。
- 每格悬停出现“🔄 换一个”：调用 AI 仅替换这一餐，要求热量与原餐相差 ±15% 以内。
- 每格可点击手动编辑（菜名/份量/kcal）。
- 本周要点 tips 展示在表格下方。
- 移动端：表格横向滚动，首列固定。

### 6.5 设置 Settings
- 个人档案表单（第 4 节 Profile 字段），实时显示 BMI/BMR/TDEE/热量目标。
- AI 配置：Base URL、API Key（密码框）、模型名、直连模式开关、“测试连接”按钮；预设快捷按钮：DeepSeek / 通义千问 / Kimi / OpenAI（仅填入 Base URL 与默认模型名）。
- 数据管理：导出 JSON、导入 JSON（覆盖前确认，校验结构）、清空所有数据（二次确认）。

## 7. AI 交互

统一调用 `POST {baseUrl}/chat/completions`，`temperature` 0.7，超时 60s（周计划）/ 20s（鼓励、单餐）。请求设置 `response_format: {type: 'json_object'}`；若服务返回 400，自动去掉该字段重试一次（部分模型不支持）。

### 7.1 周食谱
- system：你是注册营养师，擅长中式家常减脂餐……只输出 JSON。
- user：包含性别、年龄、身高、当前体重、目标体重、BMI、活动量、每日热量目标、饮食偏好；要求：中国家常可获得食材、外卖友好、高蛋白、每日四餐总热量在目标 ±5% 内、7 天菜品尽量不重复、给出份量克数；并附 JSON 结构示例（同 WeekPlan.days + tips）。
- 解析：`parse.ts` 提取首个 JSON 对象 → 校验 7 天 × 4 餐、kcal 为正数 → 失败则报错“AI 返回格式不正确，请重试”，并保留原计划。

### 7.2 单餐替换
传入：当天其他三餐、原餐、热量范围、偏好 → 返回单个 Meal JSON。

### 7.3 鼓励语
- 传入：最近 14 天体重序列、今日 vs 昨日变化、7 日均线趋势、今日热量状态、连续打卡天数、累计减重。
- 要求：80–150 字，温暖真诚、具体引用数据、不说教；体重上升时解释正常波动（水分、钠、生理期等）并安抚；不给医疗建议。
- 结果缓存到当天 `DailyRecord.encouragement`；修改当天打卡后可点“换一句”重新生成。

### 7.4 离线兜底（domain/encourage.ts）
未配置 AI 或调用失败时，按场景从内置语料随机选（每类 ≥5 条）：首次打卡、体重下降、持平、上升、连续 3/7/30 天、热量达标、热量超标、达成里程碑。

## 8. 激励机制（domain/badges.ts）

- **连续打卡**：从今天（或昨天，若今天未打卡）往前数连续有记录的天数。
- **里程碑徽章**：累计减重 1 / 3 / 5 / 10 / 15 / 20 kg；BMI 跨出一个分级；连续打卡 7 / 30 / 100 天。
- 新解锁徽章在打卡后以动画弹出一次（已展示徽章记录在 store 中）。

## 9. 错误处理

| 场景 | 处理 |
|---|---|
| 未配置 AI | 周表页显示引导卡片“去设置配置 AI”；鼓励语走离线兜底 |
| 网络错误/超时/401/429 | Toast 显示归一化中文错误（如“API Key 无效”“请求过于频繁”），不覆盖已有数据 |
| AI 返回非法 JSON | 提示重试，保留旧数据 |
| 体重输入非法 | 限制 30–300 kg、最多 1 位小数，表单内提示 |
| 导入文件非法 | 拒绝导入并提示原因 |
| localStorage 写满/不可用 | Toast 提示并建议导出备份 |

## 10. 测试

- **Vitest 单测**：`calc.ts`（BMI/BMR/TDEE/目标下限/均线/统计/预计日期）、`badges.ts`（连续打卡跨天、断签、里程碑）、`encourage.ts`（场景判定）、`parse.ts`（```json 包裹、多余文字、缺字段、天数不足）。
- **手动验证**：首次引导 → 填档案 → 配置 AI → 生成周表 → 打卡 → 查看图表/鼓励 → 换一餐 → 导出/导入。

## 11. 免责声明

应用底部及周表页显示：“AI 饮食建议仅供参考，如有慢性疾病请咨询医生或注册营养师。”
