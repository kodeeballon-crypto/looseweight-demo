import { useState } from 'react';
import dayjs from 'dayjs';
import type { Activity, BreakfastMode, DinnerMinutes, Lifestyle, LunchMode, Profile, Routine, Sex } from '../../types';
import { DEFAULT_LIFESTYLE } from '../../types';
import { ACTIVITY_LABELS_MAP, bmiLevel, calcBmi, calcBmr, calcKcalTarget, calcTdee } from '../../domain/calc';
import { BREAKFAST_LABELS_MAP, DINNER_LABELS_MAP, DINNER_OPTIONS, LUNCH_LABELS_MAP, ROUTINE_LABELS_MAP } from '../../domain/lifestyle';
import { useT } from '../../i18n';
import { LIMITS } from '../../config/limits';

interface Props {
  initial: Profile | null;
  currentWeight: number | null;
  onSave: (p: Profile) => void;
  saveLabel: string;
}

type Form = Record<'heightCm' | 'startWeightKg' | 'targetWeightKg' | 'age', string> & {
  sex: Sex;
  activity: Activity;
  startDate: string;
  preferences: string;
  lifestyle: Lifestyle;
};

export default function ProfileForm({ initial, currentWeight, onSave, saveLabel }: Props) {
  const { lang } = useT();
  const [f, setF] = useState<Form>({
    heightCm: initial ? String(initial.heightCm) : '',
    startWeightKg: initial ? String(initial.startWeightKg) : '',
    targetWeightKg: initial ? String(initial.targetWeightKg) : '',
    age: initial ? String(initial.age) : '',
    sex: initial?.sex ?? 'male',
    activity: initial?.activity ?? 'sedentary',
    startDate: initial?.startDate ?? dayjs().format('YYYY-MM-DD'),
    preferences: initial?.preferences ?? '',
    lifestyle: initial?.lifestyle ?? DEFAULT_LIFESTYLE,
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const [hMin, hMax] = LIMITS.heightCm;
  const [wMin, wMax] = LIMITS.weightKg;
  const [aMin, aMax] = LIMITS.age;
  const weightMsg = lang === 'en' ? `Weight must be between ${wMin}–${wMax} kg` : `体重需在 ${wMin}–${wMax} kg`;
  const rules: Record<'heightCm' | 'startWeightKg' | 'targetWeightKg' | 'age', [number, number, string]> = {
    heightCm: [hMin, hMax, lang === 'en' ? `Height must be between ${hMin}–${hMax} cm` : `身高需在 ${hMin}–${hMax} cm`],
    startWeightKg: [wMin, wMax, weightMsg],
    targetWeightKg: [wMin, wMax, weightMsg],
    age: [aMin, aMax, lang === 'en' ? `Age must be between ${aMin}–${aMax} years` : `年龄需在 ${aMin}–${aMax} 岁`],
  };

  const errors: Partial<Record<keyof Form, string>> = {};
  for (const k of Object.keys(rules) as (keyof typeof rules)[]) {
    const n = Number(f[k]);
    const [min, max, msg] = rules[k];
    if (f[k].trim() === '' || !Number.isFinite(n) || n < min || n > max) errors[k] = msg;
  }
  if (!errors.targetWeightKg && !errors.startWeightKg && Number(f.targetWeightKg) >= Number(f.startWeightKg))
    errors.targetWeightKg = lang === 'en' ? 'Target weight should be lower than starting weight' : '目标体重应低于初始体重';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.startDate)) errors.startDate = lang === 'en' ? 'Please choose a date' : '请选择日期';
  const valid = Object.keys(errors).length === 0;

  // 实时指标（以最新体重或初始体重计算）
  const h = Number(f.heightCm);
  const w = currentWeight ?? Number(f.startWeightKg);
  const a = Number(f.age);
  const canCalc = !errors.heightCm && !errors.age && (currentWeight !== null || !errors.startWeightKg);
  const bmi = canCalc ? calcBmi(w, h) : null;
  const bmr = canCalc ? calcBmr(f.sex, w, h, a) : null;
  const tdee = bmr !== null ? calcTdee(bmr, f.activity) : null;
  const target = tdee !== null ? calcKcalTarget(tdee, f.sex) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSave({
      heightCm: Number(f.heightCm),
      startWeightKg: Number(f.startWeightKg),
      targetWeightKg: Number(f.targetWeightKg),
      age: Math.round(Number(f.age)),
      sex: f.sex,
      activity: f.activity,
      startDate: f.startDate,
      preferences: f.preferences.trim() || undefined,
      lifestyle: f.lifestyle,
    });
  };

  const num = (k: keyof typeof rules, label: string, unit: string, ph: string) => (
    <div className="field">
      <label htmlFor={`pf-${k}`}>{label}</label>
      <div className="input-suffix">
        <input
          id={`pf-${k}`}
          className={`input ${touched && errors[k] ? 'invalid' : ''}`}
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={ph}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
        />
        <span>{unit}</span>
      </div>
      {touched && errors[k] && <div className="field-error">{errors[k]}</div>}
    </div>
  );

  const setLife = <K extends keyof Lifestyle>(k: K, v: Lifestyle[K]) => setF((s) => ({ ...s, lifestyle: { ...s.lifestyle, [k]: v } }));
  const seg = <V extends string>(k: 'routine' | 'breakfast' | 'lunch', label: string, labels: Record<V, string>) => (
    <div className="lifestyle-row">
      <span className="lifestyle-label">{label}</span>
      <div className="segmented">
        {(Object.keys(labels) as V[]).map((v) => (
          <button
            type="button"
            key={v}
            id={`pf-${k}-${v}`}
            className={f.lifestyle[k] === v ? 'on' : ''}
            onClick={() => setLife(k, v as never)}
          >
            {labels[v]}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field">
          <span className="field-label">{lang === 'en' ? 'Sex' : '性别'}</span>
          <div className="segmented">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button type="button" key={s} id={`pf-sex-${s}`} className={f.sex === s ? 'on' : ''} onClick={() => set('sex', s)}>
                {lang === 'en' ? (s === 'male' ? '👨 Male' : '👩 Female') : (s === 'male' ? '👨 男' : '👩 女')}
              </button>
            ))}
          </div>
        </div>
        {num('age', lang === 'en' ? 'Age' : '年龄', lang === 'en' ? 'yrs' : '岁', '30')}
        {num('heightCm', lang === 'en' ? 'Height' : '身高', 'cm', '170')}
        {num('startWeightKg', lang === 'en' ? 'Start Weight' : '初始体重', 'kg', '90')}
        {num('targetWeightKg', lang === 'en' ? 'Target Weight' : '目标体重', 'kg', '70')}
        <div className="field">
          <label htmlFor="pf-startDate">{lang === 'en' ? 'Start Date' : '开始日期'}</label>
          <input id="pf-startDate" className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div className="field span-all">
          <label htmlFor="pf-activity">{lang === 'en' ? 'Activity Level' : '日常活动量'}</label>
          <select id="pf-activity" className="select" value={f.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_LABELS_MAP[lang]) as Activity[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS_MAP[lang][k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field span-all">
          <span className="field-label">{lang === 'en' ? 'Lifestyle & Routine (AI tailors meal schedule accordingly)' : '生活节奏（AI 会按你的时间安排食谱）'}</span>
          <div className="lifestyle-grid">
            {seg<Routine>('routine', lang === 'en' ? 'Role' : '身份', ROUTINE_LABELS_MAP[lang])}
            {seg<BreakfastMode>('breakfast', lang === 'en' ? 'Weekday Breakfast' : '工作日早餐', BREAKFAST_LABELS_MAP[lang])}
            {seg<LunchMode>('lunch', lang === 'en' ? 'Weekday Lunch' : '工作日午餐', LUNCH_LABELS_MAP[lang])}
            <div className="lifestyle-row">
              <span className="lifestyle-label">{lang === 'en' ? 'Dinner Prep Time' : '晚餐做饭时间'}</span>
              <div className="segmented">
                {DINNER_OPTIONS.map((v: DinnerMinutes) => (
                  <button type="button" key={v} id={`pf-dinner-${v}`} className={f.lifestyle.dinnerMinutes === v ? 'on' : ''} onClick={() => setLife('dinnerMinutes', v)}>
                    {DINNER_LABELS_MAP[lang][v]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="field span-all">
          <label htmlFor="pf-preferences">{lang === 'en' ? 'Dietary Preferences / Restrictions (shared with AI)' : '饮食偏好 / 忌口（会告诉 AI）'}</label>
          <textarea
            id="pf-preferences"
            className="textarea"
            placeholder={lang === 'en' ? 'e.g., no cilantro, love noodles, allergic to shellfish, budget within $10/day' : '例如：不吃香菜，爱吃面食，对海鲜过敏，预算每天 50 元以内'}
            value={f.preferences}
            onChange={(e) => set('preferences', e.target.value)}
          />
        </div>
      </div>

      <div className="live-metrics mt-24">
        <div className="live-metric">
          <span>BMI</span>
          <b className="num">{bmi ? bmi.toFixed(1) : '--'}</b> {bmi && <span className="tag">{bmiLevel(bmi, lang).label}</span>}
        </div>
        <div className="live-metric">
          <span>{lang === 'en' ? 'Basal Metabolic Rate (BMR)' : '基础代谢 BMR'}</span>
          <b className="num">{bmr ? Math.round(bmr) : '--'}</b> <small className="faint">kcal</small>
        </div>
        <div className="live-metric">
          <span>{lang === 'en' ? 'Daily Energy Expenditure (TDEE)' : '每日消耗 TDEE'}</span>
          <b className="num">{tdee ? Math.round(tdee) : '--'}</b> <small className="faint">kcal</small>
        </div>
        <div className="live-metric" style={{ borderColor: 'rgba(255,120,73,.4)' }}>
          <span>{lang === 'en' ? 'Daily Calorie Target' : '每日热量目标'}</span>
          <b className="num grad-text">{target ?? '--'}</b> <small className="faint">kcal</small>
        </div>
      </div>
      {currentWeight !== null && (
        <p className="field-hint mt-8">
          {lang === 'en' ? `* Calculated using latest check-in weight ${currentWeight} kg` : `* 指标按最新打卡体重 ${currentWeight} kg 计算`}
        </p>
      )}

      <div className="row mt-24" style={{ justifyContent: 'flex-end' }}>
        <button id="pf-save" type="submit" className="btn btn-primary btn-lg">
          {saveLabel}
        </button>
      </div>
    </form>
  );
}
