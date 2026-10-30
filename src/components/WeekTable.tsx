import type { Meal, MealKey, WeekPlan, Weekday } from '../types';
import { MEAL_EMOJI, MEAL_KEYS, WEEKDAY_LABELS_MAP, getMealLabel, getMealText } from '../types';
import { useT } from '../i18n';

interface Props {
  plan: WeekPlan;
  today: Weekday;
  busyCell: string | null;
  aiReady: boolean;
  onEdit: (w: Weekday, k: MealKey) => void;
  onSwap: (w: Weekday, k: MealKey) => void;
  /** 待应用的 AI 修改，key 为 cellId */
  preview?: Map<string, Meal>;
}

export const cellId = (w: Weekday, k: MealKey) => `${w}-${k}`;

export default function WeekTable({ plan, today, busyCell, aiReady, onEdit, onSwap, preview }: Props) {
  const { lang } = useT();
  const days = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  const hl = (w: number) => (w === today ? 'is-today' : '');

  return (
    <div className="week-scroll">
      <div className="week">
        <div className="wk-corner" />
        {days.map((d) => (
          <div key={d.weekday} className={`wk-day-head ${hl(d.weekday)}`}>
            {WEEKDAY_LABELS_MAP[lang][d.weekday - 1]}
            <small>{d.weekday === today ? (lang === 'en' ? "Today's meals" : '今天吃这些') : ' '}</small>
            {d.weekday === today && <span className="today-flag">TODAY</span>}
          </div>
        ))}

        {MEAL_KEYS.map((k) => (
          <div key={k} style={{ display: 'contents' }}>
            <div className="wk-row-head">
              <span className="e">{MEAL_EMOJI[k]}</span>
              {getMealLabel(k, lang)}
            </div>
            {days.map((d) => {
              const id = cellId(d.weekday, k);
              const next = preview?.get(id);
              const m = next ?? d.meals[k];
              const mText = getMealText(m, lang);
              const origText = getMealText(d.meals[k], lang);
              const busy = busyCell === id;
              return (
                <div
                  key={id}
                  id={`cell-${id}`}
                  className={`wk-cell ${hl(d.weekday)} ${busy ? 'busy' : ''} ${next ? 'is-preview' : ''}`}
                  onClick={() => !next && onEdit(d.weekday, k)}
                  title={next
                    ? (lang === 'en' ? `Original: ${origText.name} (${d.meals[k].kcal} kcal)` : `原：${origText.name}（${d.meals[k].kcal} kcal）`)
                    : (lang === 'en' ? 'Click to edit' : '点击编辑')}
                >
                  {next && <span className="preview-flag">{lang === 'en' ? 'Pending' : '待应用'}</span>}
                  <div className="wk-name">{mText.name}</div>
                  {next && <div className="wk-old">{origText.name}</div>}
                  <div className="wk-items">{mText.items}</div>
                  <span className="tag tag-kcal num">{m.kcal} kcal</span>
                  {aiReady && !next && (
                    <button
                      className="btn btn-sm btn-violet wk-swap"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwap(d.weekday, k);
                      }}
                    >
                      {busy ? <span className="spinner" /> : '🔄'} {lang === 'en' ? 'Swap' : '换一个'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="wk-row-head wk-total-label" style={{ borderBottom: 'none' }}>
          {lang === 'en' ? 'Total' : '合计'}
        </div>
        {days.map((d) => {
          const before = MEAL_KEYS.reduce((s, k) => s + d.meals[k].kcal, 0);
          const total = MEAL_KEYS.reduce((s, k) => s + (preview?.get(cellId(d.weekday, k)) ?? d.meals[k]).kcal, 0);
          const diff = total - plan.dailyKcalTarget;
          const color = Math.abs(diff) <= plan.dailyKcalTarget * 0.05 ? 'var(--ok-text)' : diff > 0 ? 'var(--over-text)' : 'var(--sky-text)';
          return (
            <div key={d.weekday} className={`wk-total num ${hl(d.weekday)}`} style={{ color }}>
              {total !== before && <span className="wk-total-old">{before} → </span>}
              {total} kcal
            </div>
          );
        })}
      </div>
    </div>
  );
}
