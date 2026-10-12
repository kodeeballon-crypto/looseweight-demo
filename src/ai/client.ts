import type { Settings } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export function isAiConfigured(s: Settings): boolean {
  return !!(s.baseUrl.trim() && s.apiKey.trim() && s.model.trim());
}

function normalizeStatus(status: number, detail: string): AiError {
  const suffix = detail ? `（${detail.slice(0, 120)}）` : '';
  if (status === 401 || status === 403) return new AiError('API Key 无效或没有权限，请检查设置', status);
  if (status === 404) return new AiError(`接口地址或模型名不正确${suffix}`, status);
  if (status === 429) return new AiError('请求过于频繁或额度不足，请稍后再试', status);
  if (status === 402) return new AiError('账户余额不足，请充值后再试', status);
  if (status >= 500) return new AiError(`AI 服务暂时不可用（${status}）${suffix}`, status);
  return new AiError(`请求失败（${status}）${suffix}`, status);
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      return j?.error?.message ?? j?.message ?? text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

interface ChatOptions {
  timeoutMs: number;
  json?: boolean;
  temperature?: number;
}

/** 调用 OpenAI 兼容 chat/completions，返回 assistant 文本 */
export async function chat(settings: Settings, messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  if (!isAiConfigured(settings)) throw new AiError('还没有配置 AI，请先到设置页填写');

  const base = settings.baseUrl.trim().replace(/\/+$/, '');
  const url = settings.directMode ? `${base}/chat/completions` : '/ai-proxy/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey.trim()}`,
  };
  if (!settings.directMode) headers['x-target-base'] = base;

  const send = async (withJsonFormat: boolean) => {
    const body: Record<string, unknown> = {
      model: settings.model.trim(),
      messages,
      temperature: opts.temperature ?? 0.7,
    };
    if (withJsonFormat) body.response_format = { type: 'json_object' };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
    try {
      return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    } catch (e) {
      if (ac.signal.aborted) throw new AiError(`请求超时（${Math.round(opts.timeoutMs / 1000)} 秒），请稍后重试`);
      throw new AiError('网络错误，无法连接 AI 服务' + (settings.directMode ? '（直连模式可能被跨域拦截，可关闭直连试试）' : ''));
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await send(!!opts.json);
  // 部分模型不支持 response_format，400 时去掉重试一次
  if (res.status === 400 && opts.json) res = await send(false);
  if (!res.ok) throw normalizeStatus(res.status, await errorDetail(res));

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError('AI 服务返回了无法识别的内容');
  }
  const content = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiError('AI 返回内容为空，请重试');
  return content;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
