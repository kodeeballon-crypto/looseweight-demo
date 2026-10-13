import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { toast } from '../../store/toast';
import { chat, errorMessage, isAiConfigured } from '../../ai/client';
import { PING_MESSAGES } from '../../ai/prompts';

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
];

export default function AiConfig() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    try {
      const reply = await chat(settings, PING_MESSAGES, { timeoutMs: 20000 });
      toast(`连接成功 🎉 模型回复：${reply.slice(0, 30)}`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">快捷预设（只填 Base URL 和模型名）</span>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              id={`ai-preset-${p.name}`}
              type="button"
              className={`btn btn-sm ${settings.baseUrl === p.baseUrl ? 'btn-violet' : ''}`}
              onClick={() => setSettings({ baseUrl: p.baseUrl, model: p.model })}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="ai-baseUrl">Base URL</label>
          <input
            id="ai-baseUrl"
            className="input"
            placeholder="https://api.deepseek.com"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ baseUrl: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="ai-model">模型名</label>
          <input
            id="ai-model"
            className="input"
            placeholder="deepseek-flash"
            value={settings.model}
            onChange={(e) => setSettings({ model: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ai-apiKey">API Key</label>
        <div className="row">
          <input
            id="ai-apiKey"
            className="input"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-..."
            autoComplete="off"
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
          />
          <button type="button" className="btn btn-ghost" onClick={() => setShowKey((v) => !v)} aria-label="显示/隐藏 Key">
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
        <span className="field-hint">Key 只保存在本机浏览器 localStorage 中，导出备份时不会包含。</span>
      </div>

      <div className="row-between wrap">
        <div className="row">
          <button
            id="ai-direct"
            type="button"
            className={`switch ${settings.directMode ? 'on' : ''}`}
            onClick={() => setSettings({ directMode: !settings.directMode })}
            aria-pressed={settings.directMode}
          />
          <div>
            <div style={{ fontWeight: 600 }}>直连模式</div>
            <div className="field-hint">默认关闭：经本地 Vite 代理转发，避免跨域。仅对支持 CORS 的服务开启。</div>
          </div>
        </div>
        <button id="ai-test" type="button" className="btn btn-violet" disabled={!isAiConfigured(settings) || testing} onClick={test}>
          {testing ? <span className="spinner" /> : '🔌'} 测试连接
        </button>
      </div>
    </div>
  );
}
