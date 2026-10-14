import { useState } from 'react';
import type { TrainingDays, TrainingLevel, TrainingMinutes, TrainingPlace, TrainingPrefs } from '../types';
import { DAY_OPTIONS, DEFAULT_PREFS, LEVEL_LABELS_MAP, MINUTE_OPTIONS, PLACE_LABELS_MAP, getLevelLabel, getPlaceLabel } from '../domain/workout';
import { Modal } from './Modal';
import { useT } from '../i18n';

interface Props {
  open: boolean;
  initial: TrainingPrefs | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: (p: TrainingPrefs) => void;
}

export default function TrainingPrefsModal({ open, initial, saveLabel, onClose, onSave }: Props) {
  const { lang } = useT();
  const defaultSave = lang === 'en' ? 'Save' : '保存';
  return (
    <Modal open={open} onClose={onClose}>
      {open && <Inner initial={initial} saveLabel={saveLabel ?? defaultSave} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function Inner({ initial, saveLabel, onClose, onSave }: Omit<Props, 'open'> & { saveLabel: string }) {
  const { lang } = useT();
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
      <h3>⚙️ {lang === 'en' ? 'Workout Preferences' : '训练条件'}</h3>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {lang === 'en'
          ? 'AI Coach will schedule exercises and duration according to these preferences. You can also adjust them in chat later.'
          : 'AI 教练会按这些条件安排动作和时长，之后也可以在对话里调整'}
      </p>
      <div className="lifestyle-grid mt-16">
        {row('place', lang === 'en' ? 'Location' : '训练场地', Object.keys(PLACE_LABELS_MAP.zh) as TrainingPlace[], p.place, (v) => getPlaceLabel(v, lang), (v) => set('place', v))}
        {row('min', lang === 'en' ? 'Duration' : '每次时长', MINUTE_OPTIONS, p.minutes, (v: TrainingMinutes) => (lang === 'en' ? `${v} min` : `${v} 分钟`), (v) => set('minutes', v))}
        {row('days', lang === 'en' ? 'Frequency' : '每周天数', DAY_OPTIONS, p.daysPerWeek, (v: TrainingDays) => (lang === 'en' ? `${v} days` : `${v} 天`), (v) => set('daysPerWeek', v))}
        {row('level', lang === 'en' ? 'Fitness Level' : '运动基础', Object.keys(LEVEL_LABELS_MAP.zh) as TrainingLevel[], p.level, (v) => getLevelLabel(v, lang), (v) => set('level', v))}
      </div>
      <div className="field mt-16">
        <label htmlFor="tp-limits">{lang === 'en' ? 'Injuries / Restrictions (shared with AI)' : '伤病 / 不能做的动作（会告诉 AI）'}</label>
        <textarea
          id="tp-limits"
          className="textarea"
          placeholder={lang === 'en' ? 'e.g., bad knees (no jumping), lower back discomfort, only one pair of 5kg dumbbells' : '例如：膝盖不好不能跳，腰不太好，只有一副 5kg 哑铃'}
          value={p.limits}
          onChange={(e) => set('limits', e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {lang === 'en' ? 'Cancel' : '取消'}
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
