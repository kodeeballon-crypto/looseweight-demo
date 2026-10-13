import type { Exercise, WorkoutDay, WorkoutPlan, Weekday } from '../types';
import { WEEKDAY_LABELS } from '../types';
import { dayBurn } from '../domain/workout';

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
              {WEEKDAY_LABELS[d.weekday - 1]}
              <small>{shown.focus}</small>
              {d.weekday === today && <span className="today-flag">TODAY</span>}
            </div>
          );
        })}

        <div className="wk-row-head">
          <span className="e">🏋️</span>
          训练
        </div>
        {days.map((d) => {
          const next = preview?.get(d.weekday);
          const day = next ?? d;
          const isToday = d.weekday === today;
          const canCheck = isToday && !next;
          const allDone = day.exercises.length > 0 && day.exercises.every((e) => doneIds.has(e.id));
          return (
            <div
              key={d.weekday}
              id={`wo-cell-${d.weekday}`}
              className={`wk-cell wo-cell ${hl(d.weekday)} ${day.exercises.length === 0 ? 'is-rest' : ''} ${next ? 'is-preview' : ''}`}
              onClick={() => !next && onEditDay(d.weekday)}
              title={next ? `原：${d.focus}（${dayBurn(d)} kcal）` : '点击编辑当天'}
            >
              {next && <span className="preview-flag">待应用</span>}
              {next && <div className="wk-old">{d.focus}</div>}
              {day.exercises.length === 0 && <div className="wo-rest">😴 好好休息</div>}
              {day.exercises.map((ex) => {
                const done = canCheck && doneIds.has(ex.id);
                const busy = busyId === ex.id;
                return (
                  <div key={ex.id} className={`wo-ex ${done ? 'done' : ''} ${busy ? 'busy' : ''}`}>
                    {canCheck && (
                      <button
                        className="wo-check"
                        aria-label={`${done ? '取消完成' : '完成'} ${ex.name}`}
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
                      <div className="wo-ex-name">{ex.name}</div>
                      {ex.detail && <div className="wo-ex-detail">{ex.detail}</div>}
                      <span className="tag tag-burn num">🔥 {ex.kcal} kcal</span>
                    </div>
                    {aiReady && !next && (
                      <button
                        className="wo-swap"
                        title="换一个"
                        aria-label={`换掉 ${ex.name}`}
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
                  {allDone ? '✅ 今日训练已完成' : '🔥 一键完成今日训练'}
                </button>
              )}
              {isToday && orphan.count > 0 && (
                <div className="wo-orphan">
                  另有 {orphan.count} 个已完成动作 · {orphan.kcal} kcal
                </div>
              )}
            </div>
          );
        })}

        <div className="wk-row-head wk-total-label" style={{ borderBottom: 'none' }}>
          合计
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
