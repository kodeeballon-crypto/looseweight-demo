# 交接说明（给接手的 Agent）

> 本文件记录之前对话中已确认的内容和当前进度，接手的 Agent 读完即可继续开发，不需要再向用户重复提问。

## 1. 项目背景

用户比较胖，想做一个**个人自用**的减重 Web 应用：
1. 输入身高、体重等档案，每天打卡体重，自动生成可视化图表和统计。
2. AI 根据身高、体重、性别等生成针对性的**一周饮食计划**，用醒目的周表展示，让人不用纠结吃什么。
3. 打卡后自动计算当天热量摄入，并给出鼓励和情绪价值。

## 2. 用户已确认的决策

| 问题 | 用户选择 |
|---|---|
| 数据存储 | 先做本地版（localStorage），以后再考虑多设备同步 |
| 饮食计划来源 | 接 AI，根据身高、体重、性别分析后生成减肥饮食计划，结果保存到本地 |
| AI 接入方式 | OpenAI 兼容接口（DeepSeek、通义千问、Kimi、OpenAI 等）。在设置页填 Base URL、API Key 和模型名，提示词写在网页里，返回结构化 JSON 周食谱 |
| 每日打卡内容 | 体重（必填）+ 当天按计划吃了哪几顿（打勾）；系统自动算当日热量，并给鼓励 |
| 技术方案 | 方案 A：Vite + React + TypeScript + ECharts + Zustand（persist 到 localStorage） |
| 项目位置 | `D:\FanHua\my-project\code\looseweight-demo` |
| 推进方式 | 用户原话：**“先按你的方案实施，我需要看到成品使用后再提出修改建议”**。直接实现完整可用的成品，不用再写详细实施计划或逐步确认 |

**完整设计文档（必读）：** [docs/superpowers/specs/2026-10-12-looseweight-design.md](superpowers/specs/2026-10-12-looseweight-design.md)
其中写明了数据模型、计算公式、页面布局、AI 提示词要求、错误处理和测试范围，实现时以它为准。

## 3. 当前进度

- [x] 需求澄清，设计文档已写好并提交（git 仓库已初始化，分支 `main`）
- [x] 创建 `package.json`，已写好 scripts：dev / build / preview / test
- [ ] **安装依赖**：上次运行被中断，`node_modules` 还不存在，需要重新执行：
  ```powershell
  npm install react react-dom react-router-dom zustand dayjs echarts
  npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest
  ```
  注意：不用 `echarts-for-react`（可能和 React 19 的 peer 依赖冲突），自己写一个轻量的 `EChart` 包装组件（useRef + echarts.init + ResizeObserver）。
- [ ] 配置文件：`vite.config.ts`（含 AI 代理中间件）、`tsconfig.json`、`index.html`
- [ ] `src/domain/`：calc.ts、badges.ts、encourage.ts，并写 Vitest 单测
- [ ] `src/ai/`：client.ts、prompts.ts、parse.ts（parse 要写单测）
- [ ] `src/store/useStore.ts`
- [ ] 页面：Dashboard、Stats、MealPlan、Settings，以及通用组件和样式
- [ ] `npm test` 和 `npm run build` 都通过后，`npm run dev` 启动，交给用户试用
- [ ] 写 README（启动方式、怎么配置 AI）

## 4. 环境信息

- Windows + PowerShell；Node v24.18.0，npm 11.16.0，git 2.55
- 开发时 AI 请求走 Vite 代理 `/ai-proxy/*`，真实目标地址放在请求头 `x-target-base` 里（详见设计文档第 2 节），这样可以避开浏览器跨域限制。

## 5. 沟通要求

- 用中文和用户交流，回答简洁。
- 做完后告诉用户怎么启动、怎么配置 AI Key，然后等用户试用后提修改意见。
