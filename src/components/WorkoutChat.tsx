import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { WorkoutChange } from '../types';
import { WEEKDAY_LABELS } from '../types';
import { chat, errorMessage } from '../ai/client';
import { adjustWorkoutMessages } from '../ai/workoutPrompts';
import { parseWorkoutAdjustment } from '../ai/parseWorkout';
import { energyInfo } from '../domain/calc';
import { DEFAULT_PREFS, dayBurn } from '../domain/workout';
import { confirmDialog } from './Modal';

export interface PendingWorkout {
  msgId: string;
  changes: WorkoutChange[];
}

interface Props {
  variant: 'panel' | 'drawer';
  open?: boolean;
  onClose?: () => void;
  pending: PendingWorkout | null;
  onPending: (p: PendingWorkout | null) => void;
}

const QUICK = ['膝盖不太好', '只有一副哑铃', '这周很忙，每次 20 分钟', '深蹲怎么做才标准？', '练完很酸怎么办', '今天想换成有氧'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();

interface LocalError {
  id: string;
  text: string;
  at: string;
}

export default function WorkoutChat({ variant, open, onClose, pending, onPending }: Props) {
  const {
    profile,
    records,
    settings,
    trainingPrefs,
    workoutPlan,
    workoutChat,
    workoutMemory,
    appendWorkoutChat,
    markWorkoutChatApplied,
    clearWorkoutChat,
    updateWorkoutMemory,
    removeWorkoutMemory,
    applyWorkoutChanges,
  } = useStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<LocalError[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [workoutChat.length, errors.length, sending, pending]);

  if (!profile || !workoutPlan) return null;

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    onPending(null); // 新方案基于当前已生效的周表
    const history = workoutChat;
    appendWorkoutChat({ id: uid(), role: 'user', text, at: now() });
    setInput('');
    setSending(true);
    try {
      const weightKg = energyInfo(profile, records).weightKg;
      const res = await chat(
        settings,
        adjustWorkoutMessages({ profile, weightKg, prefs: trainingPrefs ?? DEFAULT_PREFS, plan: workoutPlan, memory: workoutMemory, history, userText: text }),
        { timeoutMs: 45000, json: true, temperature: 0.6 },
      );
      const adj = parseWorkoutAdjustment(res);
      const id = uid();
      appendWorkoutChat({ id, role: 'assistant', text: adj.reply, at: now(), changeCount: adj.changes.length });
      updateWorkoutMemory(adj.memoryAdd, adj.memoryRemove);
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
    applyWorkoutChanges(pending.changes);
    markWorkoutChatApplied(pending.msgId);
    onPending(null);
    toast(`已更新 ${pending.changes.length} 天训练 ✨`, 'success');
  };

  const clear = async () => {
    if (!(await confirmDialog({ title: '清空对话？', message: '对话记录会被删除，已记住的长期要求会保留。', okText: '清空' }))) return;
    clearWorkoutChat();
    setErrors([]);
    onPending(null);
  };

  const items = [
    ...workoutChat.map((m) => ({ ...m, kind: m.role as 'user' | 'assistant' | 'error' })),
    ...errors.map((e) => ({ ...e, kind: 'error' as const, role: 'assistant' as const, applied: false, changeCount: 0 })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <aside className={`plan-chat plan-chat-${variant} ${open ? 'open' : ''}`} aria-label="AI 教练对话">
      <header className="chat-head">
        <div className="chat-avatar" style={{ background: 'var(--grad-burn)' }}>
          🏋️
        </div>
        <div className="chat-title">
          <h2>AI 教练</h2>
          <p>调整计划，或问我动作怎么做</p>
        </div>
        {workoutChat.length > 0 && (
          <button id="wchat-clear" className="chat-icon-btn" title="清空对话" onClick={clear}>
            🗑️
          </button>
        )}
        {variant === 'drawer' && (
          <button id="wchat-close" className="chat-icon-btn" title="收起" onClick={onClose}>
            ✕
          </button>
        )}
      </header>

      <div className="chat-memory">
        {workoutMemory.length === 0 ? (
          <span className="chat-memory-empty">📌 我记住的长期训练要求会显示在这里</span>
        ) : (
          workoutMemory.map((m) => (
            <span key={m} className="chip chip-memory">
              📌 {m}
              <button aria-label={`删除 ${m}`} onClick={() => removeWorkoutMemory(m)}>
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="chat-list" ref={listRef}>
        {items.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-ico">💪</div>
            <p>想调整训练，或者有动作不会做？直接问我，比如：</p>
            <p className="faint">
              “膝盖有点疼，能把跳跃动作换掉吗”
              <br />
              “平板支撑腰酸是姿势不对吗”
            </p>
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.kind}`}>
            {m.kind === 'error' && '⚠️ '}
            {m.text}
            {m.kind === 'assistant' && !!m.changeCount && (
              <span className={`bubble-meta ${m.applied ? 'is-applied' : ''}`}>
                {m.applied ? `✅ 已应用 ${m.changeCount} 天修改` : pending?.msgId === m.id ? `📝 ${m.changeCount} 天修改待确认` : `${m.changeCount} 天修改未应用`}
              </span>
            )}
          </div>
        ))}
        {sending && (
          <div className="bubble bubble-assistant bubble-typing" aria-label="AI 正在思考">
            <i />
            <i />
            <i />
          </div>
        )}

        {pending && (
          <div className="change-card">
            <div className="change-card-title">将修改 {pending.changes.length} 天训练</div>
            <ul className="change-list">
              {pending.changes.map((c) => {
                const old = workoutPlan.days.find((d) => d.weekday === c.weekday)!;
                const diff = dayBurn(c.next) - dayBurn(old);
                return (
                  <li key={c.weekday}>
                    <span className="change-where">{WEEKDAY_LABELS[c.weekday - 1]}</span>
                    <span className="change-what">
                      <s>{old.focus}</s> → <b>{c.next.focus}</b>
                      <br />
                      <small className="faint">{c.next.exercises.map((e) => e.name).join('、') || '休息'}</small>
                    </span>
                    <span className={`num change-kcal ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                      {diff > 0 ? '+' : ''}
                      {diff}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="change-actions">
              <button id="wchat-discard" className="btn btn-sm" onClick={() => onPending(null)}>
                放弃
              </button>
              <button id="wchat-apply" className="btn btn-sm btn-burn" onClick={apply}>
                ✅ 应用
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="chat-quick">
        {QUICK.map((q) => (
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
          id="wchat-input"
          className="chat-input"
          rows={Math.min(4, Math.max(1, input.split('\n').length))}
          placeholder="说说你的情况或问题…（Enter 发送，Shift+Enter 换行）"
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
        <button id="wchat-send" type="submit" className="chat-send" disabled={sending || !input.trim()} aria-label="发送">
          {sending ? <span className="spinner" /> : '➤'}
        </button>
      </form>
    </aside>
  );
}
