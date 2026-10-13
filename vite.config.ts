import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * AI 代理中间件：前端把请求发到 /ai-proxy/*，并在请求头 x-target-base 中带上真实 Base URL，
 * 这里用 Node 原生 fetch 转发，从而绕过浏览器 CORS 限制。Base URL 不写死在配置里。
 */
const PREFIX = '/ai-proxy';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJsonError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: { message } }));
}

async function aiProxy(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url ?? '';
  if (!url.startsWith(PREFIX + '/')) return next();

  const targetBase = req.headers['x-target-base'];
  if (typeof targetBase !== 'string' || !/^https?:\/\//i.test(targetBase)) {
    return sendJsonError(res, 400, '缺少或非法的 x-target-base 请求头');
  }
  const target = targetBase.replace(/\/+$/, '') + url.slice(PREFIX.length);
  const method = (req.method ?? 'GET').toUpperCase();

  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });

  try {
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
    const headers: Record<string, string> = {
      'content-type': (req.headers['content-type'] as string) || 'application/json',
    };
    if (req.headers.authorization) headers.authorization = req.headers.authorization;

    const upstream = await fetch(target, { method, headers, body, signal: ac.signal });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json');
    res.end(text);
  } catch (err) {
    if (ac.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    sendJsonError(res, 502, `代理请求失败：${msg}`);
  }
}

function aiProxyPlugin(): Plugin {
  return {
    name: 'looseweight-ai-proxy',
    configureServer(server) {
      server.middlewares.use(aiProxy);
    },
    configurePreviewServer(server) {
      server.middlewares.use(aiProxy);
    },
  };
}

export default defineConfig({
  plugins: [react(), aiProxyPlugin()],
  // localStorage 按“源”（协议+域名+端口）隔离：端口一变，之前的数据就“看不见”了。
  // strictPort 让 5173 被占用时直接报错，而不是悄悄换到 5174 导致数据像是丢了。
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
