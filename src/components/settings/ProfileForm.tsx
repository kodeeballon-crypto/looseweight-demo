import { useState } from 'react';
import dayjs from 'dayjs';
import type { Activity, Profile, Sex } from '../../types';
import { ACTIVITY_LABELS, bmiLevel, calcBmi, calcBmr, calcKcalTarget, calcTdee } from '../../domain/calc';

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
};

const RULES: Record<'heightCm' | 'startWeightKg' | 'targetWeightKg' | 'age', [number, number, string]> = {
  heightCm: [100, 250, '身高需在 100–250 cm'],
  startWeightKg: [30, 300, '体重需在 30–300 kg'],
  targetWeightKg: [30, 300, '体重需在 30–300 kg'],
  age: [10, 100, '年龄需在 10–100 岁'],
};

export default function ProfileForm({ initial, currentWeight, onSave, saveLabel }: Props) {
  const [f, setF] = useState<Form>({
    heightCm: initial ? String(initial.heightCm) : '',
    startWeightKg: initial ? String(initial.startWeightKg) : '',
    targetWeightKg: initial ? String(initial.targetWeightKg) : '',
    age: initial ? String(initial.age) : '',
    sex: initial?.sex ?? 'male',
    activity: initial?.activity ?? 'sedentary',
    startDate: initial?.startDate ?? dayjs().format('YYYY-MM-DD'),
    preferences: initial?.preferences ?? '',
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const errors: Partial<Record<keyof Form, string>> = {};
  for (const k of Object.keys(RULES) as (keyof typeof RULES)[]) {
    const n = Number(f[k]);
    const [min, max, msg] = RULES[k];
    if (f[k].trim() === '' || !Number.isFinite(n) || n < min || n > max) errors[k] = msg;
  }
  if (!errors.targetWeightKg && !errors.startWeightKg && Number(f.targetWeightKg) >= Number(f.startWeightKg))
    errors.targetWeightKg = '目标体重应低于初始体重';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.startDate)) errors.startDate = '请选择日期';
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
    });
  };

  const num = (k: keyof typeof RULES, label: string, unit: string, ph: string) => (
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

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field">
          <span className="field-label">性别</span>
          <div className="segmented">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button type="button" key={s} id={`pf-sex-${s}`} className={f.sex === s ? 'on' : ''} onClick={() => set('sex', s)}>
                {s === 'male' ? '👨 男' : '👩 女'}
              </button>
            ))}
          </div>
        </div>
        {num('age', '年龄', '岁', '30')}
        {num('heightCm', '身高', 'cm', '170')}
        {num('startWeightKg', '初始体重', 'kg', '90')}
        {num('targetWeightKg', '目标体重', 'kg', '70')}
        <div className="field">
          <label htmlFor="pf-startDate">开始日期</label>
          <input id="pf-startDate" className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div className="field span-all">
          <label htmlFor="pf-activity">日常活动量</label>
          <select id="pf-activity" className="select" value={f.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field span-all">
          <label htmlFor="pf-preferences">饮食偏好 / 忌口（会告诉 AI）</label>
          <textarea
            id="pf-preferences"
            className="textarea"
            placeholder="例如：不吃香菜，爱吃面食，对海鲜过敏，工作日午餐点外卖"
            value={f.preferences}
            onChange={(e) => set('preferences', e.target.value)}
          />
        </div>
      </div>

      <div className="live-metrics mt-24">
        <div className="live-metric">
          <span>BMI</span>
          <b className="num">{bmi ? bmi.toFixed(1) : '--'}</b> {bmi && <span className="tag">{bmiLevel(bmi).label}</span>}
        </div>
        <div className="live-metric">
          <span>基础代谢 BMR</span>
          <b className="num">{bmr ? Math.round(bmr) : '--'}</b> <small className="faint">kcal</small>
        </div>
        <div className="live-metric">
          <span>每日消耗 TDEE</span>
          <b className="num">{tdee ? Math.round(tdee) : '--'}</b> <small className="faint">kcal</small>
        </div>
        <div className="live-metric" style={{ borderColor: 'rgba(52,224,161,.4)' }}>
          <span>每日热量目标</span>
          <b className="num grad-text">{target ?? '--'}</b> <small className="faint">kcal</small>
        </div>
      </div>
      {currentWeight !== null && <p className="field-hint mt-8">* 指标按最新打卡体重 {currentWeight} kg 计算</p>}

      <div className="row mt-24" style={{ justifyContent: 'flex-end' }}>
        <button id="pf-save" type="submit" className="btn btn-primary btn-lg">
          {saveLabel}
        </button>
      </div>
    </form>
  );
}
