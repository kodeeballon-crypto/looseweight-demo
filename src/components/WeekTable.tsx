import type { MealKey, WeekPlan, Weekday } from '../types';
import { MEAL_EMOJI, MEAL_KEYS, MEAL_LABELS, WEEKDAY_LABELS } from '../types';

interface Props {
  plan: WeekPlan;
  today: Weekday;
  busyCell: string | null;
  aiReady: boolean;
  onEdit: (w: Weekday, k: MealKey) => void;
  onSwap: (w: Weekday, k: MealKey) => void;
}

export const cellId = (w: Weekday, k: MealKey) => `${w}-${k}`;

export default function WeekTable({ plan, today, busyCell, aiReady, onEdit, onSwap }: Props) {
  const days = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  const hl = (w: number) => (w === today ? 'is-today' : '');

  return (
    <div className="week-scroll">
      <div className="week">
        <div className="wk-corner" />
        {days.map((d) => (
          <div key={d.weekday} className={`wk-day-head ${hl(d.weekday)}`}>
            {WEEKDAY_LABELS[d.weekday - 1]}
            <small>{d.weekday === today ? '今天吃这些' : ' '}</small>
            {d.weekday === today && <span className="today-flag">TODAY</span>}
          </div>
        ))}

        {MEAL_KEYS.map((k) => (
          <div key={k} style={{ display: 'contents' }}>
            <div className="wk-row-head">
              <span className="e">{MEAL_EMOJI[k]}</span>
              {MEAL_LABELS[k]}
            </div>
            {days.map((d) => {
              const m = d.meals[k];
              const id = cellId(d.weekday, k);
              const busy = busyCell === id;
              return (
                <div
                  key={id}
                  id={`cell-${id}`}
                  className={`wk-cell ${hl(d.weekday)} ${busy ? 'busy' : ''}`}
                  onClick={() => onEdit(d.weekday, k)}
                  title="点击编辑"
                >
                  <div className="wk-name">{m.name}</div>
                  <div className="wk-items">{m.items}</div>
                  <span className="tag tag-kcal num">{m.kcal} kcal</span>
                  {aiReady && (
                    <button
                      className="btn btn-sm btn-violet wk-swap"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwap(d.weekday, k);
                      }}
                    >
                      {busy ? <span className="spinner" /> : '🔄'} 换一个
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="wk-row-head wk-total-label" style={{ borderBottom: 'none' }}>
          合计
        </div>
        {days.map((d) => {
          const total = MEAL_KEYS.reduce((s, k) => s + d.meals[k].kcal, 0);
          const diff = total - plan.dailyKcalTarget;
          const color = Math.abs(diff) <= plan.dailyKcalTarget * 0.05 ? 'var(--ok)' : diff > 0 ? 'var(--over)' : 'var(--sky)';
          return (
            <div key={d.weekday} className={`wk-total num ${hl(d.weekday)}`} style={{ color }}>
              {total} kcal
            </div>
          );
        })}
      </div>
    </div>
  );
}
