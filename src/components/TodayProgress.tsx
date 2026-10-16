import { Link } from 'react-router-dom';
import type { WorkoutDay } from '../types';
import { MEAL_KEYS, getWorkoutFocus } from '../types';
import { useT } from '../i18n';

interface Props {
  mealsEaten: number;
  /** 今天的训练安排；undefined 表示还没有训练计划 */
  workout: WorkoutDay | undefined;
  doneCount: number;
  burned: number;
}

const pct = (a: number, b: number) => `${b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0}%`;

/** 首页：今日饮食与训练完成情况（训练用红色） */
export default function TodayProgress({ mealsEaten, workout, doneCount, burned }: Props) {
  const { lang } = useT();
  const mealsTotal = MEAL_KEYS.length;
  const total = workout?.exercises.length ?? 0;
  const restDay = !!workout && total === 0;
  const trainDone = restDay || (total > 0 && doneCount >= total);
  const allDone = mealsEaten >= mealsTotal && trainDone;

  return (
    <section className="card" id="today-progress" style={{ animationDelay: '300ms' }}>
      <div className="card-title">
        <h2>{lang === 'en' ? '✅ Today’s Completion' : '✅ 今日完成情况'}</h2>
        {burned > 0 && <span className="tag tag-burn num">🔥 {lang === 'en' ? `Burned ${burned} kcal` : `已消耗 ${burned} kcal`}</span>}
      </div>
      {allDone && <div className="tp-banner">{lang === 'en' ? '🎉 All meals & workouts completed today' : '🎉 今日饮食与训练全部完成'}</div>}

      <div className="tp-row">
        <div className="tp-head">
          <span>{lang === 'en' ? '🥗 Meals' : '🥗 饮食'}</span>
          <b className="num">
            {mealsEaten} / {mealsTotal} {lang === 'en' ? 'meals' : '餐'}
          </b>
        </div>
        <div className="tp-bar">
          <i className="tp-fill diet" style={{ width: pct(mealsEaten, mealsTotal) }} />
        </div>
      </div>

      <div className="tp-row">
        <div className="tp-head">
          <span>{lang === 'en' ? '🏋️ Workout' : '🏋️ 训练'}</span>
          {!workout ? (
            <Link to="/workout">{lang === 'en' ? 'Generate workout plan →' : '去生成训练计划 →'}</Link>
          ) : restDay ? (
            <b>{lang === 'en' ? 'Rest Day 😴' : '今天休息 😴'}</b>
          ) : (
            <b className="num burn-text">
              {doneCount} / {total} {lang === 'en' ? 'exercises' : '个动作'} · {burned} kcal
            </b>
          )}
        </div>
        <div className="tp-bar">
          <i className="tp-fill train" style={{ width: restDay ? '100%' : pct(doneCount, total) }} />
        </div>
        {workout && !restDay && !trainDone && (
          <div className="field-hint mt-8">
            {lang === 'en' ? (
              <>Focus: "{getWorkoutFocus(workout, lang)}". <Link to="/workout">Log workout →</Link></>
            ) : (
              <>今天练「{getWorkoutFocus(workout, lang)}」，<Link to="/workout">去打卡训练 →</Link></>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
