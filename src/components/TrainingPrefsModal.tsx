import { useState } from 'react';
import type { TrainingDays, TrainingLevel, TrainingMinutes, TrainingPlace, TrainingPrefs } from '../types';
import { DAY_OPTIONS, DEFAULT_PREFS, LEVEL_LABELS, MINUTE_OPTIONS, PLACE_LABELS } from '../domain/workout';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  initial: TrainingPrefs | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: (p: TrainingPrefs) => void;
}

export default function TrainingPrefsModal({ open, initial, saveLabel = '保存', onClose, onSave }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      {open && <Inner initial={initial} saveLabel={saveLabel} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function Inner({ initial, saveLabel, onClose, onSave }: Omit<Props, 'open'> & { saveLabel: string }) {
  const [p, setP] = useState<TrainingPrefs>(initial ?? DEFAULT_PREFS);
  const set = <K extends keyof TrainingPrefs>(k: K, v: TrainingPrefs[K]) => setP((s) => ({ ...s, [k]: v }));

  const row = <V extends string | number>(id: string, label: string, options: V[], value: V, text: (v: V) => string, on: (v: V) => void) => (
    <div className="lifestyle-row">
      <span className="lifestyle-label">{label}</span>
      <div className="segmented">
        {options.map((v) => (
          <button type="button" key={v} id={`tp-${id}-${v}`} className={value === v ? 'on' : ''} onClick={() => on(v)}>
            {text(v)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <h3>⚙️ 训练条件</h3>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        AI 教练会按这些条件安排动作和时长，之后也可以在对话里调整
      </p>
      <div className="lifestyle-grid mt-16">
        {row('place', '训练场地', Object.keys(PLACE_LABELS) as TrainingPlace[], p.place, (v) => PLACE_LABELS[v], (v) => set('place', v))}
        {row('min', '每次时长', MINUTE_OPTIONS, p.minutes, (v: TrainingMinutes) => `${v} 分钟`, (v) => set('minutes', v))}
        {row('days', '每周天数', DAY_OPTIONS, p.daysPerWeek, (v: TrainingDays) => `${v} 天`, (v) => set('daysPerWeek', v))}
        {row('level', '运动基础', Object.keys(LEVEL_LABELS) as TrainingLevel[], p.level, (v) => LEVEL_LABELS[v], (v) => set('level', v))}
      </div>
      <div className="field mt-16">
        <label htmlFor="tp-limits">伤病 / 不能做的动作（会告诉 AI）</label>
        <textarea
          id="tp-limits"
          className="textarea"
          placeholder="例如：膝盖不好不能跳，腰不太好，只有一副 5kg 哑铃"
          value={p.limits}
          onChange={(e) => set('limits', e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button
          id="tp-save"
          className="btn btn-burn"
          onClick={() => {
            onSave({ ...p, limits: p.limits.trim() });
            onClose();
          }}
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}
