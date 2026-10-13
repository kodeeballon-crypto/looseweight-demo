import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { MEAL_EMOJI, MEAL_KEYS, MEAL_LABELS } from '../types';
import { chat, errorMessage, isAiConfigured } from '../ai/client';
import { nutritionMessages } from '../ai/nutritionPrompts';
import { parseNutrition } from '../ai/parseNutrition';
import { energyInfo, weekdayOf } from '../domain/calc';
import { todayStr } from '../services/encourage';
import {
  MACRO_COLORS,
  MACRO_KINDS,
  MACRO_LABELS,
  MACRO_RANGE,
  RATING_LABELS,
  macroShares,
  mealSignature,
  rateShare,
  sumMacros,
  todayMeals,
} from '../domain/nutrition';
import MacroPie from './MacroPie';

const RATING_TAG = { low: 'tag-slight', ok: 'tag-ok', high: 'tag-over' } as const;

/** 饮食周表：今日营养结构（饼图 + 本地评级 + AI 点评） */
export default function NutritionCard() {
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
      const raw = await chat(settings, nutritionMessages(profile, target, keys, meals), { timeoutMs: 30000, json: true });
      const r = parseNutrition(raw, keys);
      setNutrition({ date, signature, ...r, at: new Date().toISOString() });
      toast('今日营养结构已分析 🥧', 'success');
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
        <h2>🥧 今日营养结构</h2>
        <div className="nutri-actions">
          <span className={`tag ${preview ? 'tag-kcal' : 'tag-ok'}`}>{preview ? '按计划预览' : '已打卡'}</span>
          {aiReady && keys.length > 0 && (
            <button id="nutrition-analyze" className="btn btn-primary btn-sm" disabled={busy} onClick={analyze}>
              {busy ? <span className="spinner" /> : '✨'} {analysis ? '重新分析' : '分析今日饮食'}
            </button>
          )}
        </div>
      </div>

      {keys.length === 0 ? (
        <p className="muted nutri-empty">今天打卡时没有勾选计划内的餐，暂无可分析的饮食。</p>
      ) : !aiReady ? (
        <p className="muted nutri-empty">
          营养素克数由 AI 估算，<Link to="/settings">先去设置配置 AI →</Link>
        </p>
      ) : !analysis ? (
        <p className="muted nutri-empty">
          将分析今天的 {keys.map((k) => MEAL_LABELS[k]).join('、')}，估算蛋白质 / 碳水 / 脂肪的克数与热量占比，并给出结构点评（约 10–30 秒）。
        </p>
      ) : (
        <>
          {stale && (
            <div className="nutri-stale">
              ⚠️ 餐食已变化，下面是之前的分析结果。
              <button className="link-btn" disabled={busy} onClick={analyze}>
                点击重新分析
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
                        <b>{MACRO_LABELS[kind]}</b>
                        <span className="num">{total![kind]} g</span>
                        <span className="num nutri-pct">{pct}%</span>
                        <span className={`tag ${RATING_TAG[rating]}`}>{RATING_LABELS[rating]}</span>
                      </div>
                      <div className="nutri-bar">
                        <i className="nutri-range" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                        <i className="nutri-fill" style={{ width: `${Math.min(100, pct)}%`, background: MACRO_COLORS[kind] }} />
                      </div>
                      <span className="field-hint">参考 {lo}–{hi}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="nutri-summary">
            <div className="nutri-summary-title">🧑‍⚕️ AI 营养师点评</div>
            <p>{analysis.summary}</p>
            {analysis.suggestions.length > 0 && (
              <ul className="nutri-tips">
                {analysis.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>

          <table className="nutri-table">
            <thead>
              <tr>
                <th>餐次</th>
                {MACRO_KINDS.map((k) => (
                  <th key={k}>{MACRO_LABELS[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyzedKeys.map((k) => (
                <tr key={k}>
                  <td>
                    {MEAL_EMOJI[k]} {MEAL_LABELS[k]}
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

      {extra > 0 && <p className="field-hint mt-8">计划外摄入 {extra} kcal 未计入饼图</p>}
    </section>
  );
}
