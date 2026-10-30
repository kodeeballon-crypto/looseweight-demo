import type { Settings } from '../types';

/** AI 服务商预设：只填 Base URL 和模型名，名称通过 i18n key `aiPreset.<id>` 显示 */
export const AI_PRESETS = [
  { id: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { id: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
] as const;

export type AiPresetId = (typeof AI_PRESETS)[number]['id'];

/** 默认服务商（首次打开 / 清空数据后使用） */
export const DEFAULT_PRESET = AI_PRESETS[0];

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_PRESET.baseUrl,
  apiKey: '',
  model: DEFAULT_PRESET.model,
  directMode: false,
};

/** 各场景请求超时（毫秒） */
export const AI_TIMEOUT = {
  /** 测试连接 */
  ping: 20_000,
  /** 打卡鼓励语 */
  encourage: 20_000,
  /** 换一道菜 / 换一个动作 */
  swap: 20_000,
  /** 营养结构分析 */
  nutrition: 30_000,
  /** AI 营养师 / 教练对话 */
  chat: 45_000,
  /** 生成整周食谱 / 训练 */
  weekPlan: 60_000,
  /** 翻译：鼓励语、单日食谱、营养点评 */
  translateShort: 25_000,
  /** 翻译：整周训练 */
  translateWorkout: 45_000,
  /** 翻译：整周食谱 */
  translateWeek: 60_000,
} as const;

/** 采样温度：生成类偏发散，翻译类偏保守 */
export const AI_TEMPERATURE = {
  default: 0.7,
  /** 鼓励语：希望每次措辞有变化 */
  encourage: 0.9,
  chat: 0.6,
  translate: 0.3,
  translateEncourage: 0.4,
} as const;
