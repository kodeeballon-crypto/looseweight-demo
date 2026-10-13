import { useState } from 'react';
import type { WorkoutDay } from '../types';
import { exerciseId } from '../domain/workout';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  day: WorkoutDay | null;
  onClose: () => void;
  onSave: (d: WorkoutDay) => void;
}

interface Row {
  id: string;
  name: string;
  detail: string;
  kcal: string;
}

export default function WorkoutDayModal({ open, title, day, onClose, onSave }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="modal-wide">
      {day && <Inner key={title} title={title} day={day} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

const kcalOk = (s: string) => {
  const n = Number(s);
  return s !== '' && Number.isFinite(n) && n >= 1 && n <= 2000;
};

function Inner({ title, day, onClose, onSave }: { title: string; day: WorkoutDay; onClose: () => void; onSave: (d: WorkoutDay) => void }) {
  const [focus, setFocus] = useState(day.focus);
  const [rows, setRows] = useState<Row[]>(day.exercises.map((e) => ({ id: e.id, name: e.name, detail: e.detail, kcal: String(e.kcal) })));
  const valid = focus.trim() !== '' && rows.every((r) => r.name.trim() !== '' && kcalOk(r.kcal));
  const patch = (id: string, p: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <>
      <h3>✏️ 编辑 · {title}</h3>
      <div className="stack mt-16" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="wd-focus">训练重点</label>
          <input id="wd-focus" className="input" placeholder="如：下肢力量 / 有氧燃脂 / 休息·拉伸" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>
        <span className="field-label">动作（休息日可以不填）</span>
        {rows.map((r, i) => (
          <div key={r.id} className="ex-edit-row">
            <input id={`wd-name-${i}`} className="input" placeholder="动作名" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
            <input id={`wd-detail-${i}`} className="input" placeholder="组数×次数 / 时长 · 要点" value={r.detail} onChange={(e) => patch(r.id, { detail: e.target.value })} />
            <div className="input-suffix">
              <input
                id={`wd-kcal-${i}`}
                className={`input ${kcalOk(r.kcal) || r.kcal === '' ? '' : 'invalid'}`}
                type="number"
                inputMode="numeric"
                value={r.kcal}
                onChange={(e) => patch(r.id, { kcal: e.target.value })}
              />
              <span>kcal</span>
            </div>
            <button className="btn btn-sm btn-ghost" aria-label="删除动作" onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}>
              🗑️
            </button>
          </div>
        ))}
        <button
          id="wd-add"
          className="btn btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setRows((list) => [...list, { id: exerciseId(), name: '', detail: '', kcal: '50' }])}
        >
          ＋ 添加动作
        </button>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button
          id="wd-save"
          className="btn btn-burn"
          disabled={!valid}
          onClick={() => {
            onSave({
              weekday: day.weekday,
              focus: focus.trim(),
              exercises: rows.map((r) => ({ id: r.id, name: r.name.trim(), detail: r.detail.trim(), kcal: Math.round(Number(r.kcal)) })),
            });
            onClose();
          }}
        >
          保存
        </button>
      </div>
    </>
  );
}
