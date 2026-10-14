import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DailyRecord, MealKey, WeekPlan } from '../types';
import { MEAL_EMOJI, MEAL_KEYS, getMealLabel } from '../types';
import { intakeOf, weekdayOf } from '../domain/calc';
import { useT } from '../i18n';
import type { Lang } from '../i18n/types';

export type CheckInValues = Omit<DailyRecord, 'encouragement'>;

interface Props {
  date: string;
  initial?: DailyRecord;
  plan: WeekPlan | null;
  submitLabel: string;
  busy?: boolean;
  idPrefix?: string;
  onSubmit: (v: CheckInValues) => void;
}

/** 体重：30–300 kg，最多 1 位小数 */
export function validateWeight(s: string, lang: Lang = 'zh'): string | null {
  if (s.trim() === '') return lang === 'en' ? 'Please enter your weight' : '请输入体重';
  if (!/^\d{2,3}(\.\d)?$/.test(s.trim())) return lang === 'en' ? 'Please enter a number, max 1 decimal' : '请输入数字，最多 1 位小数';
  const n = Number(s);
  if (n < 30 || n > 300) return lang === 'en' ? 'Weight must be between 30–300 kg' : '体重需在 30–300 kg 之间';
  return null;
}

export default function CheckInForm({ date, initial, plan, submitLabel, busy, idPrefix = 'checkin', onSubmit }: Props) {
  const { lang } = useT();
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [meals, setMeals] = useState<MealKey[]>(initial?.mealsEaten ?? []);
  const [extra, setExtra] = useState(initial?.extraKcal ? String(initial.extraKcal) : '');
  const [touched, setTouched] = useState(false);

  const day = plan?.days.find((d) => d.weekday === weekdayOf(date));
  const weightErr = validateWeight(weight, lang);
  const extraNum = extra.trim() === '' ? 0 : Number(extra);
  const extraErr = !Number.isFinite(extraNum) || extraNum < 0 || extraNum > 10000
    ? (lang === 'en' ? 'Please enter a number between 0–10000' : '请输入 0–10000 的数字')
    : null;
  const intake = intakeOf({ date, mealsEaten: meals, extraKcal: extraNum || undefined }, plan).kcal;

  const toggle = (k: MealKey) => setMeals((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (weightErr || extraErr) return;
    onSubmit({
      date,
      weightKg: Number(weight),
      mealsEaten: MEAL_KEYS.filter((k) => meals.includes(k)),
      extraKcal: extraNum > 0 ? Math.round(extraNum) : undefined,
    });
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${idPrefix}-weight`}>{lang === 'en' ? 'Today’s Weight' : '今日体重'}</label>
        <div className="input-suffix">
          <input
            id={`${idPrefix}-weight`}
            className={`input input-big ${touched && weightErr ? 'invalid' : ''}`}
            type="text"
            inputMode="decimal"
            placeholder={lang === 'en' ? 'e.g. 75.5' : '例如 82.5'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="off"
          />
          <span>kg</span>
        </div>
        {touched && weightErr && <div className="field-error">{weightErr}</div>}
      </div>

      <div className="field">
        <div className="row-between">
          <span className="field-label">{lang === 'en' ? 'Which planned meals did you eat?' : '按计划吃了哪几顿？'}</span>
          <span className="tag tag-kcal num">{lang === 'en' ? `Total ${intake} kcal` : `合计 ${intake} kcal`}</span>
        </div>
        {day ? (
          <div className="meal-checks">
            {MEAL_KEYS.map((k) => {
              const on = meals.includes(k);
              return (
                <button
                  type="button"
                  id={`${idPrefix}-meal-${k}`}
                  key={k}
                  className={`meal-check ${on ? 'on' : ''}`}
                  onClick={() => toggle(k)}
                  aria-pressed={on}
                >
                  <span className="tick">{on ? '✓' : ''}</span>
                  <span className="mc-body">
                    <span className="mc-top">
                      {MEAL_EMOJI[k]} {getMealLabel(k, lang)}
                    </span>
                    <span className="mc-name" style={{ display: 'block' }}>
                      {day.meals[k].name}
                    </span>
                  </span>
                  <span className="mc-kcal num">{day.meals[k].kcal}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="no-plan-hint">
            {lang === 'en' ? (
              <>No meal plan yet. Extra calories only. <Link to="/plan">Generate meal plan →</Link></>
            ) : (
              <>还没有饮食计划，暂时只统计计划外摄入。<Link to="/plan">先生成饮食计划 →</Link></>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-extra`}>{lang === 'en' ? 'Extra Calories (optional)' : '计划外摄入（可选）'}</label>
        <div className="input-suffix">
          <input
            id={`${idPrefix}-extra`}
            className={`input ${extraErr ? 'invalid' : ''}`}
            type="number"
            inputMode="numeric"
            placeholder={lang === 'en' ? 'e.g. 1 milk tea ~300' : '如：一杯奶茶约 300'}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          <span>kcal</span>
        </div>
        {extraErr && <div className="field-error">{extraErr}</div>}
      </div>

      <button id={`${idPrefix}-submit`} type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy && <span className="spinner" />}
        {submitLabel}
      </button>
    </form>
  );
}
