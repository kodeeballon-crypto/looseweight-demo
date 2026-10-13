import { useState } from 'react';
import type { Meal } from '../types';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  meal: Meal | null;
  onClose: () => void;
  onSave: (m: Meal) => void;
}

export default function MealEditModal({ open, title, meal, onClose, onSave }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      {meal && <Inner key={title} title={title} meal={meal} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function Inner({ title, meal, onClose, onSave }: { title: string; meal: Meal; onClose: () => void; onSave: (m: Meal) => void }) {
  const [name, setName] = useState(meal.name);
  const [items, setItems] = useState(meal.items);
  const [kcal, setKcal] = useState(String(meal.kcal));
  const kcalNum = Number(kcal);
  const valid = name.trim() !== '' && Number.isFinite(kcalNum) && kcalNum > 0 && kcalNum < 5000;

  return (
    <>
      <h3>✏️ 编辑 · {title}</h3>
      <div className="stack mt-16">
        <div className="field">
          <label htmlFor="meal-name">菜名</label>
          <input id="meal-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="meal-items">份量说明</label>
          <textarea id="meal-items" className="textarea" value={items} onChange={(e) => setItems(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="meal-kcal">热量</label>
          <div className="input-suffix">
            <input
              id="meal-kcal"
              className={`input ${valid || kcal === '' ? '' : 'invalid'}`}
              type="number"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
            <span>kcal</span>
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button
          id="meal-save"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => {
            onSave({ name: name.trim(), items: items.trim(), kcal: Math.round(kcalNum) });
            onClose();
          }}
        >
          保存
        </button>
      </div>
    </>
  );
}
