import type { Settings } from '../types';
import { AI_TEMPERATURE } from '../config/ai';
import { getT } from '../i18n';
import { LocalizedError } from '../i18n/errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends LocalizedError {
  constructor(
    code: string,
    params?: Record<string, string | number>,
    public status?: number,
  ) {
    super(code, params);
    this.name = 'AiError';
  }
}

export function isAiConfigured(s: Settings): boolean {
  return !!(s.baseUrl.trim() && s.apiKey.trim() && s.model.trim());
}

function normalizeStatus(status: number, detail: string): AiError {
  const d = detail ? getT()('aiError.detail', { text: detail.slice(0, 120) }) : '';
  if (status === 401 || status === 403) return new AiError('aiError.unauthorized', undefined, status);
  if (status === 404) return new AiError('aiError.notFound', { detail: d }, status);
  if (status === 429) return new AiError('aiError.rateLimited', undefined, status);
  if (status === 402) return new AiError('aiError.insufficientBalance', undefined, status);
  if (status >= 500) return new AiError('aiError.serverError', { status, detail: d }, status);
  return new AiError('aiError.requestFailed', { status, detail: d }, status);
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
  if (!isAiConfigured(settings)) throw new AiError('aiError.notConfigured');

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
      temperature: opts.temperature ?? AI_TEMPERATURE.default,
    };
    if (withJsonFormat) body.response_format = { type: 'json_object' };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
    try {
      return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    } catch {
      if (ac.signal.aborted) throw new AiError('aiError.timeout', { s: Math.round(opts.timeoutMs / 1000) });
      const err = new AiError('aiError.network');
      if (settings.directMode) err.message += getT()('aiError.networkDirectHint');
      throw err;
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
    throw new AiError('aiError.badResponse');
  }
  const content = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiError('aiError.emptyResponse');
  return content;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
