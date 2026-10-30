import { useState } from 'react';
import { AI_TIMEOUT } from '../config/ai';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { MEAL_EMOJI, MEAL_KEYS, getMealLabel, getNutritionText } from '../types';
import { chat, errorMessage, isAiConfigured } from '../ai/client';
import { nutritionMessages } from '../ai/nutritionPrompts';
import { parseNutrition } from '../ai/parseNutrition';
import { energyInfo, weekdayOf } from '../domain/calc';
import { todayStr } from '../services/encourage';
import {
  MACRO_COLORS,
  MACRO_KINDS,
  MACRO_RANGE,
  getMacroLabel,
  getRatingLabel,
  macroShares,
  mealSignature,
  rateShare,
  sumMacros,
  todayMeals,
} from '../domain/nutrition';
import MacroPie from './MacroPie';
import { useT } from '../i18n';

const RATING_TAG = { low: 'tag-slight', ok: 'tag-ok', high: 'tag-over' } as const;

/** 饮食周表：今日营养结构（饼图 + 本地评级 + AI 点评） */
export default function NutritionCard() {
  const { lang } = useT();
  const { profile, records, plan, settings, nutritionCache, setNutrition } = useStore();
  const [busy, setBusy] = useState(false);
  if (!profile || !plan) return null;

  const date = todayStr();
  const record = records.find((r) => r.date === date);
  const { keys, meals, preview } = todayMeals(plan, record, weekdayOf(date));
  const signature = mealSignature(keys, meals);
  const analysis = nutritionCache[date];
  const stale = !!analysis && analysis.signature !== signature;
  const aiReady = isAiConfigured(settings);
  const extra = record?.extraKcal ?? 0;

  const analyze = async () => {
    setBusy(true);
    try {
      const target = energyInfo(profile, records).target;
      const raw = await chat(settings, nutritionMessages(profile, target, keys, meals), { timeoutMs: AI_TIMEOUT.nutrition, json: true });
      const r = parseNutrition(raw, keys);
      setNutrition({ date, signature, ...r, at: new Date().toISOString() });
      toast(lang === 'en' ? "Today's nutrition structure analyzed 🥧" : '今日营养结构已分析 🥧', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error'); // 保留旧结果
    } finally {
      setBusy(false);
    }
  };

  const total = analysis ? sumMacros(analysis, MEAL_KEYS) : null;
  const shares = total ? macroShares(total) : null;
  const analyzedKeys = analysis ? MEAL_KEYS.filter((k) => analysis.meals[k]) : [];

  return (
    <section className="card mt-24 nutri-card" id="nutrition-card">
      <div className="card-title">
        <h2>{lang === 'en' ? "🥧 Today's Nutrition Breakdown" : '🥧 今日营养结构'}</h2>
        <div className="nutri-actions">
          <span className={`tag ${preview ? 'tag-kcal' : 'tag-ok'}`}>
            {preview ? (lang === 'en' ? 'Plan Preview' : '按计划预览') : (lang === 'en' ? 'Logged' : '已打卡')}
          </span>
          {aiReady && keys.length > 0 && (
            <button id="nutrition-analyze" className="btn btn-primary btn-sm" disabled={busy} onClick={analyze}>
              {busy ? <span className="spinner" /> : '✨'} {analysis ? (lang === 'en' ? 'Re-analyze' : '重新分析') : (lang === 'en' ? 'Analyze Today' : '分析今日饮食')}
            </button>
          )}
        </div>
      </div>

      {keys.length === 0 ? (
        <p className="muted nutri-empty">
          {lang === 'en' ? 'No planned meals were checked in today. No diet data to analyze yet.' : '今天打卡时没有勾选计划内的餐，暂无可分析的饮食。'}
        </p>
      ) : !aiReady ? (
        <p className="muted nutri-empty">
          {lang === 'en' ? 'Nutrient grams are estimated by AI. ' : '营养素克数由 AI 估算，'}
          <Link to="/settings">{lang === 'en' ? 'Configure AI in Settings first →' : '先去设置配置 AI →'}</Link>
        </p>
      ) : !analysis ? (
        <p className="muted nutri-empty">
          {lang === 'en'
            ? `Will analyze today's ${keys.map((k) => getMealLabel(k, lang)).join(', ')}, estimate grams and calorie ratios for protein, carbs, and fat, and provide structural insights (~10–30s).`
            : `将分析今天的 ${keys.map((k) => getMealLabel(k, lang)).join('、')}，估算蛋白质 / 碳水 / 脂肪的克数与热量占比，并给出结构点评（约 10–30 秒）。`}
        </p>
      ) : (
        <>
          {stale && (
            <div className="nutri-stale">
              {lang === 'en' ? '⚠️ Meals have changed; previous analysis is shown below. ' : '⚠️ 餐食已变化，下面是之前的分析结果。'}
              <button className="link-btn" disabled={busy} onClick={analyze}>
                {lang === 'en' ? 'Click to re-analyze' : '点击重新分析'}
              </button>
            </div>
          )}
          <div className="nutri-body">
            <div className="nutri-chart">
              <MacroPie macros={total!} />
            </div>
            <div className="nutri-rates">
              {MACRO_KINDS.map((kind) => {
                const pct = shares![kind];
                const rating = rateShare(kind, pct);
                const [lo, hi] = MACRO_RANGE[kind];
                return (
                  <div className="nutri-rate" key={kind}>
                    <i className="nutri-dot" style={{ background: MACRO_COLORS[kind] }} />
                    <div className="nutri-rate-main">
                      <div className="nutri-rate-head">
                        <b>{getMacroLabel(kind, lang)}</b>
                        <span className="num">{total![kind]} g</span>
                        <span className="num nutri-pct">{pct}%</span>
                        <span className={`tag ${RATING_TAG[rating]}`}>{getRatingLabel(rating, lang)}</span>
                      </div>
                      <div className="nutri-bar">
                        <i className="nutri-range" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                        <i className="nutri-fill" style={{ width: `${Math.min(100, pct)}%`, background: MACRO_COLORS[kind] }} />
                      </div>
                      <span className="field-hint">{lang === 'en' ? `Ref: ${lo}–${hi}%` : `参考 ${lo}–${hi}%`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="nutri-summary">
            <div className="nutri-summary-title">{lang === 'en' ? '🧑‍⚕️ AI Dietitian Comments' : '🧑‍⚕️ AI 营养师点评'}</div>
            <p>{getNutritionText(analysis, lang).summary}</p>
            {getNutritionText(analysis, lang).suggestions.length > 0 && (
              <ul className="nutri-tips">
                {getNutritionText(analysis, lang).suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>

          <table className="nutri-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Meal' : '餐次'}</th>
                {MACRO_KINDS.map((k) => (
                  <th key={k}>{getMacroLabel(k, lang)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyzedKeys.map((k) => (
                <tr key={k}>
                  <td>
                    {MEAL_EMOJI[k]} {getMealLabel(k, lang)}
                  </td>
                  {MACRO_KINDS.map((kind) => (
                    <td className="num" key={kind}>
                      {analysis.meals[k]![kind]} g
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {extra > 0 && (
        <p className="field-hint mt-8">
          {lang === 'en' ? `Extra ${extra} kcal not included in pie chart` : `计划外摄入 ${extra} kcal 未计入饼图`}
        </p>
      )}
    </section>
  );
}
