import type { Exercise, WorkoutDay, WorkoutPlan, Weekday } from '../types';
import { getExerciseText, getWeekdayLabel, getWorkoutFocus } from '../types';
import { dayBurn } from '../domain/workout';
import { useT } from '../i18n';

interface Props {
  plan: WorkoutPlan;
  today: Weekday;
  /** 今天已勾选的动作 id */
  doneIds: Set<string>;
  burnedToday: number;
  /** 今天已完成但已不在周表里的动作 */
  orphan: { count: number; kcal: number };
  aiReady: boolean;
  busyId: string | null;
  onToggle: (ex: Exercise) => void;
  onCompleteAll: () => void;
  onEditDay: (w: Weekday) => void;
  onSwap: (w: Weekday, ex: Exercise) => void;
  /** 待应用的 AI 修改（按天） */
  preview?: Map<Weekday, WorkoutDay>;
}

export default function WorkoutTable({ plan, today, doneIds, burnedToday, orphan, aiReady, busyId, onToggle, onCompleteAll, onEditDay, onSwap, preview }: Props) {
  const { lang } = useT();
  const days = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  const hl = (w: number) => (w === today ? 'is-today' : '');

  return (
    <div className="week-scroll">
      <div className="week wo-week">
        <div className="wk-corner" />
        {days.map((d) => {
          const shown = preview?.get(d.weekday) ?? d;
          return (
            <div key={d.weekday} className={`wk-day-head ${hl(d.weekday)}`}>
              {getWeekdayLabel(d.weekday, lang)}
              <small>{getWorkoutFocus(shown, lang)}</small>
              {d.weekday === today && <span className="today-flag">TODAY</span>}
            </div>
          );
        })}

        <div className="wk-row-head">
          <span className="e">🏋️</span>
          {lang === 'en' ? 'Workout' : '训练'}
        </div>
        {days.map((d) => {
          const next = preview?.get(d.weekday);
          const day = next ?? d;
          const origFocus = getWorkoutFocus(d, lang);
          const isToday = d.weekday === today;
          const canCheck = isToday && !next;
          const allDone = day.exercises.length > 0 && day.exercises.every((e) => doneIds.has(e.id));
          return (
            <div
              key={d.weekday}
              id={`wo-cell-${d.weekday}`}
              className={`wk-cell wo-cell ${hl(d.weekday)} ${day.exercises.length === 0 ? 'is-rest' : ''} ${next ? 'is-preview' : ''}`}
              onClick={() => !next && onEditDay(d.weekday)}
              title={next ? (lang === 'en' ? `Original: ${origFocus} (${dayBurn(d)} kcal)` : `原：${origFocus}（${dayBurn(d)} kcal）`) : (lang === 'en' ? 'Click to edit day' : '点击编辑当天')}
            >
              {next && <span className="preview-flag">{lang === 'en' ? 'Pending' : '待应用'}</span>}
              {next && <div className="wk-old">{origFocus}</div>}
              {day.exercises.length === 0 && <div className="wo-rest">{lang === 'en' ? '😴 Rest Day' : '😴 好好休息'}</div>}
              {day.exercises.map((ex) => {
                const done = canCheck && doneIds.has(ex.id);
                const busy = busyId === ex.id;
                const exText = getExerciseText(ex, lang);
                return (
                  <div key={ex.id} className={`wo-ex ${done ? 'done' : ''} ${busy ? 'busy' : ''}`}>
                    {canCheck && (
                      <button
                        className="wo-check"
                        aria-label={`${done ? (lang === 'en' ? 'Uncheck' : '取消完成') : (lang === 'en' ? 'Complete' : '完成')} ${exText.name}`}
                        aria-pressed={done}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(ex);
                        }}
                      >
                        {done ? '✓' : ''}
                      </button>
                    )}
                    <div className="wo-ex-body">
                      <div className="wo-ex-name">{exText.name}</div>
                      {exText.detail && <div className="wo-ex-detail">{exText.detail}</div>}
                      <span className="tag tag-burn num">🔥 {ex.kcal} kcal</span>
                    </div>
                    {aiReady && !next && (
                      <button
                        className="wo-swap"
                        title={lang === 'en' ? 'Swap' : '换一个'}
                        aria-label={lang === 'en' ? `Swap ${exText.name}` : `换掉 ${exText.name}`}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwap(d.weekday, ex);
                        }}
                      >
                        {busy ? <span className="spinner" /> : '🔄'}
                      </button>
                    )}
                  </div>
                );
              })}
              {canCheck && day.exercises.length > 0 && (
                <button
                  id="workout-complete-all"
                  className="btn btn-sm btn-burn wo-all"
                  disabled={allDone}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteAll();
                  }}
                >
                  {allDone ? (lang === 'en' ? '✅ Completed Today' : '✅ 今日训练已完成') : (lang === 'en' ? '🔥 Complete All Today' : '🔥 一键完成今日训练')}
                </button>
              )}
              {isToday && orphan.count > 0 && (
                <div className="wo-orphan">
                  {lang === 'en' ? `+${orphan.count} more completed exercises · ${orphan.kcal} kcal` : `另有 ${orphan.count} 个已完成动作 · ${orphan.kcal} kcal`}
                </div>
              )}
            </div>
          );
        })}

        <div className="wk-row-head wk-total-label" style={{ borderBottom: 'none' }}>
          {lang === 'en' ? 'Total' : '合计'}
        </div>
        {days.map((d) => {
          const before = dayBurn(d);
          const total = dayBurn(preview?.get(d.weekday) ?? d);
          return (
            <div key={d.weekday} className={`wk-total num burn-text ${hl(d.weekday)}`}>
              {total !== before && <span className="wk-total-old">{before} → </span>}
              {d.weekday === today && total === before ? `${burnedToday} / ${total} kcal` : `${total} kcal`}
            </div>
          );
        })}
      </div>
    </div>
  );
}
