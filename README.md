# 轻盈 · 减重记录（looseweight-demo）

个人自用的减重 Web 应用：每日体重打卡 → 趋势图表与统计 → AI 一周减脂饮食周表 → 打卡后自动算热量并送上鼓励。
数据只保存在本机浏览器（localStorage，key：`looseweight-v1`）。

## 启动

```powershell
npm install      # 首次
npm run dev      # 打开 http://localhost:5173
```

其他命令：`npm test`（Vitest 单测）、`npm run build`（类型检查 + 打包）、`npm run preview`（预览打包结果，同样带 AI 代理）。

## 配置 AI

1. 进入「设置 → AI 配置」，点击预设（DeepSeek / 通义千问 / Kimi / OpenAI）自动填好 Base URL 和模型名，也可以手动填任何 OpenAI 兼容接口。
2. 填入 API Key（只存在本机，导出备份时不包含）。
3. 点「测试连接」，提示成功即可。

| 服务 | Base URL | 默认模型 |
|---|---|---|
| DeepSeek | https://api.deepseek.com | deepseek-flash |
| 通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| Kimi | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |

**跨域说明：** 默认请求发往本地 `/ai-proxy/*`，由 Vite 中间件按请求头 `x-target-base` 转发到真实地址（见 `vite.config.ts`），所以必须通过 `npm run dev` / `npm run preview` 访问。“直连模式”只适用于本身支持 CORS 的服务。

未配置 AI 时，打卡鼓励使用内置语料，饮食周表页会提示先去配置。

## 使用流程

1. 首次打开 → 填写个人档案（身高、体重、目标、年龄、活动量、饮食偏好）→ 自动算出 BMI / BMR / TDEE / 每日热量目标。
2. 「饮食周表」→ 生成我的一周食谱（7 天 × 4 餐，今天这一列高亮）；点格子手动编辑，悬停点「🔄 换一个」只替换这一餐。
3. 「今日」→ 输入体重、勾选按计划吃了哪几顿、填计划外摄入 → 打卡。自动计算热量、生成鼓励、解锁徽章。
4. 「统计」→ 体重趋势（7 日均线 + 目标线）、热量柱状图、预计达成日期、历史记录编辑/删除。
5. 「设置」→ 徽章墙、导出 / 导入 JSON 备份、清空数据。

## 目录

```
src/
  domain/    纯计算：calc（BMI/BMR/TDEE/统计/预测）、badges（连续打卡/徽章）、encourage（离线鼓励语）
  ai/        client（OpenAI 兼容调用 + 错误归一化）、prompts（三套提示词）、parse（JSON 提取与校验）
  store/     useStore（Zustand + persist）、toast、dataio（导入校验）
  services/  encourage（AI 鼓励 + 离线兜底）
  components/ pages/ styles/
```

> AI 饮食建议仅供参考，如有慢性疾病请咨询医生或注册营养师。
