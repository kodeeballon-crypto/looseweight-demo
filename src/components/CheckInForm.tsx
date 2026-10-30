import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DailyRecord, Meal, MealKey, WeekPlan } from '../types';
import { MEAL_EMOJI, MEAL_KEYS, getMealLabel, getMealText } from '../types';
import { intakeOf, weekdayOf } from '../domain/calc';
import { LIMITS } from '../config/limits';
import { useT } from '../i18n';
import type { Lang } from '../i18n/types';
import { useTranslateStatus } from '../services/aiTranslate';

export type CheckInValues = Omit<DailyRecord, 'encouragement' | 'encouragementEn'>;

interface Props {
  date: string;
  initial?: DailyRecord;
  plan: WeekPlan | null;
  submitLabel: string;
  busy?: boolean;
  idPrefix?: string;
  onSubmit: (v: CheckInValues) => void;
}

/** 体重：LIMITS.weightKg 范围内，最多 1 位小数 */
export function validateWeight(s: string, lang: Lang = 'zh'): string | null {
  const [min, max] = LIMITS.weightKg;
  if (s.trim() === '') return lang === 'en' ? 'Please enter your weight' : '请输入体重';
  if (!/^\d{2,3}(\.\d)?$/.test(s.trim())) return lang === 'en' ? 'Please enter a number, max 1 decimal' : '请输入数字，最多 1 位小数';
  const n = Number(s);
  if (n < min || n > max) return lang === 'en' ? `Weight must be between ${min}–${max} kg` : `体重需在 ${min}–${max} kg 之间`;
  return null;
}

export default function CheckInForm({ date, initial, plan, submitLabel, busy, idPrefix = 'checkin', onSubmit }: Props) {
  const { lang } = useT();
  const translatingMeals = useTranslateStatus((s) => s.meals);
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [meals, setMeals] = useState<MealKey[]>(initial?.mealsEaten ?? []);
  const [extra, setExtra] = useState(initial?.extraKcal ? String(initial.extraKcal) : '');
  const [touched, setTouched] = useState(false);

  const day = plan?.days.find((d) => d.weekday === weekdayOf(date));
  /** 已打卡的餐显示打卡时的快照（同一道菜时沿用计划里的英文翻译），其余显示当前计划 */
  const mealFor = (k: MealKey): Meal | undefined => {
    const planned = day?.meals[k];
    const snap = initial?.mealSnapshot?.[k];
    if (!snap) return planned;
    if (planned && planned.name === snap.name && planned.items === snap.items)
      return { ...snap, nameEn: snap.nameEn ?? planned.nameEn, itemsEn: snap.itemsEn ?? planned.itemsEn };
    return snap;
  };
  const shownKeys = MEAL_KEYS.filter((k) => mealFor(k));
  const eatenKeys = MEAL_KEYS.filter((k) => meals.includes(k) && mealFor(k));
  const mealSnapshot: Partial<Record<MealKey, Meal>> | undefined = eatenKeys.length
    ? Object.fromEntries(eatenKeys.map((k) => [k, mealFor(k)!]))
    : undefined;
  const weightErr = validateWeight(weight, lang);
  const extraNum = extra.trim() === '' ? 0 : Number(extra);
  const [extraMin, extraMax] = LIMITS.extraKcal;
  const extraErr = !Number.isFinite(extraNum) || extraNum < extraMin || extraNum > extraMax
    ? (lang === 'en' ? `Please enter a number between ${extraMin}–${extraMax}` : `请输入 ${extraMin}–${extraMax} 的数字`)
    : null;
  const intake = intakeOf({ date, mealsEaten: meals, extraKcal: extraNum || undefined, mealSnapshot }, plan).kcal;

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
      // 保存“看到的就是存下的”：打卡时冻结所勾选餐次的菜名与热量
      mealSnapshot,
    });
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${idPrefix}-weight`}>{lang === 'en' ? "Today's Weight" : '今日体重'}</label>
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
          <span className="field-label">
            {lang === 'en' ? 'Which planned meals did you eat?' : '按计划吃了哪几顿？'}
            {lang === 'en' && translatingMeals && (
              <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                <span className="spinner" style={{ width: 11, height: 11, verticalAlign: 'middle', marginRight: 4 }} />
                AI translating…
              </span>
            )}
          </span>
          <span className="tag tag-kcal num">{lang === 'en' ? `Total ${intake} kcal` : `合计 ${intake} kcal`}</span>
        </div>
        {shownKeys.length ? (
          <div className="meal-checks">
            {shownKeys.map((k) => {
              const on = meals.includes(k);
              const meal = mealFor(k)!;
              const mealText = getMealText(meal, lang);
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
                      {mealText.name}
                    </span>
                  </span>
                  <span className="mc-kcal num">{meal.kcal}</span>
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
