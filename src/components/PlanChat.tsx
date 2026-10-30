import { useEffect, useRef, useState } from 'react';
import { AI_TEMPERATURE, AI_TIMEOUT } from '../config/ai';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { MealChange } from '../types';
import { getMealLabel, getWeekdayLabel } from '../types';
import { chat, errorMessage } from '../ai/client';
import { adjustPlanMessages } from '../ai/prompts';
import { parsePlanAdjustment } from '../ai/parse';
import { energyInfo } from '../domain/calc';
import { dayTotals } from '../domain/planChat';
import { confirmDialog } from './Modal';
import { useT } from '../i18n';

export interface PendingChange {
  msgId: string;
  changes: MealChange[];
}

interface Props {
  variant: 'panel' | 'drawer';
  open?: boolean;
  onClose?: () => void;
  pending: PendingChange | null;
  onPending: (p: PendingChange | null) => void;
}

const QUICK_ZH = ['工作日早餐 5 分钟搞定', '午餐只能点外卖', '午餐吃食堂', '晚上不想开火', '预算低一点', '这周有一天聚餐'];
const QUICK_EN = ['5-min weekday breakfast', 'Takeout only for lunch', 'Cafeteria for lunch', 'No cooking at night', 'Lower budget', 'Dining out one day this week'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();

interface LocalError {
  id: string;
  text: string;
  at: string;
}

export default function PlanChat({ variant, open, onClose, pending, onPending }: Props) {
  const { lang } = useT();
  const { profile, records, plan, settings, planChat, planMemory, appendChat, markChatApplied, clearChat, updateMemory, removeMemory, applyChanges } =
    useStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<LocalError[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [planChat.length, errors.length, sending, pending]);

  if (!profile || !plan) return null;

  const quickOptions = lang === 'en' ? QUICK_EN : QUICK_ZH;

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    onPending(null); // 新方案基于当前已生效的周表
    const history = planChat;
    appendChat({ id: uid(), role: 'user', text, at: now() });
    setInput('');
    setSending(true);
    try {
      const target = energyInfo(profile, records).target;
      const res = await chat(settings, adjustPlanMessages({ profile, kcalTarget: target, plan, memory: planMemory, history, userText: text }), {
        timeoutMs: AI_TIMEOUT.chat,
        json: true,
        temperature: AI_TEMPERATURE.chat,
      });
      const adj = parsePlanAdjustment(res);
      const id = uid();
      appendChat({ id, role: 'assistant', text: adj.reply, at: now(), changeCount: adj.changes.length });
      updateMemory(adj.memoryAdd, adj.memoryRemove);
      if (adj.changes.length) onPending({ msgId: id, changes: adj.changes });
    } catch (e) {
      setErrors((list) => [...list, { id: uid(), text: errorMessage(e), at: now() }]);
      toast(errorMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const apply = () => {
    if (!pending) return;
    applyChanges(pending.changes);
    markChatApplied(pending.msgId);
    onPending(null);
    toast(lang === 'en' ? `Updated ${pending.changes.length} meal(s) ✨` : `已更新 ${pending.changes.length} 餐 ✨`, 'success');
  };

  const clear = async () => {
    if (
      !(await confirmDialog({
        title: lang === 'en' ? 'Clear conversation?' : '清空对话？',
        message: lang === 'en' ? 'Chat messages will be deleted; remembered long-term preferences will be kept.' : '对话记录会被删除，已记住的长期要求会保留。',
        okText: lang === 'en' ? 'Clear' : '清空',
      }))
    )
      return;
    clearChat();
    setErrors([]);
    onPending(null);
  };

  const items = [
    ...planChat.map((m) => ({ ...m, kind: m.role as 'user' | 'assistant' | 'error' })),
    ...errors.map((e) => ({ ...e, kind: 'error' as const, role: 'assistant' as const, applied: false, changeCount: 0 })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const before = dayTotals(plan);
  const after = pending ? dayTotals(plan, pending.changes) : before;
  const affectedDays = pending ? [...new Set(pending.changes.map((c) => c.weekday))].sort() : [];
  const tol = plan.dailyKcalTarget * 0.05;

  return (
    <aside className={`plan-chat plan-chat-${variant} ${open ? 'open' : ''}`} aria-label={lang === 'en' ? 'AI Dietitian chat' : 'AI 营养师对话'}>
      <header className="chat-head">
        <div className="chat-avatar">🧑‍🍳</div>
        <div className="chat-title">
          <h2>{lang === 'en' ? 'AI Dietitian' : 'AI 营养师'}</h2>
          <p>{lang === 'en' ? 'Tell me your situation, I will adjust the plan' : '说说你的情况，我来调整周表'}</p>
        </div>
        {planChat.length > 0 && (
          <button id="chat-clear" className="chat-icon-btn" title={lang === 'en' ? 'Clear conversation' : '清空对话'} onClick={clear}>
            🗑️
          </button>
        )}
        {variant === 'drawer' && (
          <button id="chat-close" className="chat-icon-btn" title={lang === 'en' ? 'Close' : '收起'} onClick={onClose}>
            ✕
          </button>
        )}
      </header>

      <div className="chat-memory">
        {planMemory.length === 0 ? (
          <span className="chat-memory-empty">{lang === 'en' ? '📌 Remembered long-term preferences show here' : '📌 我记住的长期要求会显示在这里'}</span>
        ) : (
          planMemory.map((m) => (
            <span key={m} className="chip chip-memory">
              📌 {m}
              <button aria-label={lang === 'en' ? `Remove ${m}` : `删除 ${m}`} onClick={() => removeMemory(m)}>
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="chat-list" ref={listRef}>
        {items.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-ico">💬</div>
            <p>{lang === 'en' ? 'Meal plan impractical? Just tell me, for example:' : '觉得食谱不现实？直接告诉我，比如：'}</p>
            <p className="faint">
              {lang === 'en' ? (
                <>
                  “I leave home at 8 AM and have no time to cook”<br />
                  “Only fast-casual places near my office”
                </>
              ) : (
                <>
                  “我早上 8 点出门，没时间做饭”<br />
                  “公司楼下只有麻辣烫和黄焖鸡”
                </>
              )}
            </p>
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.kind}`}>
            {m.kind === 'error' && '⚠️ '}
            {m.text}
            {m.kind === 'assistant' && !!m.changeCount && (
              <span className={`bubble-meta ${m.applied ? 'is-applied' : ''}`}>
                {m.applied
                  ? (lang === 'en' ? `✅ Applied ${m.changeCount} changes` : `✅ 已应用 ${m.changeCount} 处修改`)
                  : pending?.msgId === m.id
                  ? (lang === 'en' ? `📝 ${m.changeCount} changes pending` : `📝 ${m.changeCount} 处修改待确认`)
                  : (lang === 'en' ? `${m.changeCount} changes unapplied` : `${m.changeCount} 处修改未应用`)}
              </span>
            )}
          </div>
        ))}
        {sending && (
          <div className="bubble bubble-assistant bubble-typing" aria-label={lang === 'en' ? 'AI is thinking' : 'AI 正在思考'}>
            <i />
            <i />
            <i />
          </div>
        )}

        {pending && (
          <div className="change-card">
            <div className="change-card-title">
              {lang === 'en' ? `Will adjust ${pending.changes.length} meal(s)` : `将修改 ${pending.changes.length} 餐`}
            </div>
            <ul className="change-list">
              {pending.changes.map((c) => {
                const old = plan.days.find((d) => d.weekday === c.weekday)!.meals[c.meal];
                const diff = c.next.kcal - old.kcal;
                return (
                  <li key={`${c.weekday}-${c.meal}`}>
                    <span className="change-where">
                      {getWeekdayLabel(c.weekday, lang)}·{getMealLabel(c.meal, lang)}
                    </span>
                    <span className="change-what">
                      <s>{old.name}</s> → <b>{c.next.name}</b>
                    </span>
                    <span className={`num change-kcal ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                      {diff > 0 ? '+' : ''}
                      {diff}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="change-totals">
              {affectedDays.map((w) => (
                <span key={w} className={`num ${Math.abs(after[w] - plan.dailyKcalTarget) > tol ? 'text-slight' : ''}`}>
                  {getWeekdayLabel(w, lang)} {before[w]} → {after[w]}
                </span>
              ))}
            </div>
            <div className="change-actions">
              <button id="chat-discard" className="btn btn-sm" onClick={() => onPending(null)}>
                {lang === 'en' ? 'Discard' : '放弃'}
              </button>
              <button id="chat-apply" className="btn btn-sm btn-primary" onClick={apply}>
                {lang === 'en' ? '✅ Apply' : '✅ 应用'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="chat-quick">
        {quickOptions.map((q) => (
          <button key={q} className="chip chip-quick" disabled={sending} onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          id="chat-input"
          className="chat-input"
          rows={Math.min(4, Math.max(1, input.split('\n').length))}
          placeholder={lang === 'en' ? 'Tell me what you need… (Enter to send, Shift+Enter for newline)' : '说说你的情况…（Enter 发送，Shift+Enter 换行）'}
          value={input}
          disabled={sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button id="chat-send" type="submit" className="chat-send" disabled={sending || !input.trim()} aria-label={lang === 'en' ? 'Send' : '发送'}>
          {sending ? <span className="spinner" /> : '➤'}
        </button>
      </form>
    </aside>
  );
}
