import { Link } from 'react-router-dom';
import type { WorkoutDay } from '../types';
import { MEAL_KEYS } from '../types';

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
  const mealsTotal = MEAL_KEYS.length;
  const total = workout?.exercises.length ?? 0;
  const restDay = !!workout && total === 0;
  const trainDone = restDay || (total > 0 && doneCount >= total);
  const allDone = mealsEaten >= mealsTotal && trainDone;

  return (
    <section className="card" id="today-progress" style={{ animationDelay: '300ms' }}>
      <div className="card-title">
        <h2>✅ 今日完成情况</h2>
        {burned > 0 && <span className="tag tag-burn num">🔥 已消耗 {burned} kcal</span>}
      </div>
      {allDone && <div className="tp-banner">🎉 今日饮食与训练全部完成</div>}

      <div className="tp-row">
        <div className="tp-head">
          <span>🥗 饮食</span>
          <b className="num">
            {mealsEaten} / {mealsTotal} 餐
          </b>
        </div>
        <div className="tp-bar">
          <i className="tp-fill diet" style={{ width: pct(mealsEaten, mealsTotal) }} />
        </div>
      </div>

      <div className="tp-row">
        <div className="tp-head">
          <span>🏋️ 训练</span>
          {!workout ? (
            <Link to="/workout">去生成训练计划 →</Link>
          ) : restDay ? (
            <b>今天休息 😴</b>
          ) : (
            <b className="num burn-text">
              {doneCount} / {total} 个动作 · {burned} kcal
            </b>
          )}
        </div>
        <div className="tp-bar">
          <i className="tp-fill train" style={{ width: restDay ? '100%' : pct(doneCount, total) }} />
        </div>
        {workout && !restDay && !trainDone && (
          <div className="field-hint mt-8">
            今天练「{workout.focus}」，<Link to="/workout">去打卡训练 →</Link>
          </div>
        )}
      </div>
    </section>
  );
}
