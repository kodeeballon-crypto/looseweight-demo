import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { MealKey, Weekday } from '../types';
import { MEAL_KEYS, getMealLabel, getPlanTips, getWeekdayLabel } from '../types';
import { chat, errorMessage, isAiConfigured } from '../ai/client';
import { replaceMealMessages, weekPlanMessages } from '../ai/prompts';
import { parseMeal, parseWeekPlan } from '../ai/parse';
import { energyInfo, weekdayOf } from '../domain/calc';
import { todayStr } from '../services/encourage';
import WeekTable, { cellId } from '../components/WeekTable';
import MealEditModal from '../components/MealEditModal';
import { Modal, confirmDialog } from '../components/Modal';
import { DISCLAIMER } from '../constants';
import PlanChat, { type PendingChange } from '../components/PlanChat';
import { avgDailyKcal, previewMap } from '../domain/planChat';
import { useWide } from '../hooks/useWide';
import NutritionCard from '../components/NutritionCard';
import { useT } from '../i18n';

export default function MealPlan() {
  const { profile, records, plan, settings, planMemory, setPlan, updateMeal } = useStore();
  const [generating, setGenerating] = useState(false);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ w: Weekday; k: MealKey } | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = useWide();
  const { lang } = useT();
  const preview = useMemo(() => (pending ? previewMap(pending.changes) : undefined), [pending]);
  if (!profile) return null;

  const aiReady = isAiConfigured(settings);
  const info = energyInfo(profile, records);
  const today = weekdayOf(todayStr());

  const generate = async () => {
    if (plan && !(await confirmDialog({
      title: lang === 'en' ? 'Regenerate Weekly Plan?' : '重新生成本周计划？',
      message: lang === 'en' ? 'Your current weekly plan (including manual changes) will be replaced.' : '当前周表（包括手动修改）将被替换。',
      okText: lang === 'en' ? 'Regenerate' : '重新生成',
    }))) return;
    setGenerating(true);
    try {
      const raw = await chat(settings, weekPlanMessages(profile, info.weightKg, info.target, planMemory), { timeoutMs: 60000, json: true });
      setPlan(parseWeekPlan(raw, info.target));
      setPending(null);
      toast(lang === 'en' ? 'New weekly meal plan generated 🥗' : '新的一周饮食计划已生成 🥗', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const swap = async (w: Weekday, k: MealKey) => {
    const day = plan?.days.find((d) => d.weekday === w);
    if (!day) return;
    setBusyCell(cellId(w, k));
    try {
      const others = Object.fromEntries(MEAL_KEYS.filter((x) => x !== k).map((x) => [x, day.meals[x]]));
      const raw = await chat(settings, replaceMealMessages(profile, k, day.meals[k], others), { timeoutMs: 20000, json: true });
      const meal = parseMeal(raw);
      updateMeal(w, k, meal);
      toast(
        lang === 'en'
          ? `${getWeekdayLabel(w, lang)} ${getMealLabel(k, lang)} swapped for "${meal.name}"`
          : `${getWeekdayLabel(w, 'zh')}${getMealLabel(k, 'zh')}已换成「${meal.name}」`,
        'success',
      );
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusyCell(null);
    }
  };

  const editingMeal = editing && plan ? plan.days.find((d) => d.weekday === editing.w)?.meals[editing.k] ?? null : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{lang === 'en' ? 'AI Meal Plan' : 'AI 饮食周表'}</h1>
          <p>{lang === 'en' ? 'Stop worrying about what to eat. Click to edit, hover to swap.' : '不用纠结吃什么，照着吃就好 · 点格子可编辑，悬停可“换一个”'}</p>
        </div>
        {aiReady && (
          <button id="plan-generate" className="btn btn-primary btn-lg" disabled={generating} onClick={generate}>
            {generating ? <span className="spinner" /> : '✨'}{' '}
            {plan ? (lang === 'en' ? 'Regenerate Weekly Plan' : '重新生成本周计划') : (lang === 'en' ? 'Generate Weekly Plan' : '生成我的一周食谱')}
          </button>
        )}
      </div>

      {!aiReady && (
        <div className="card guide-card">
          <div className="big">🤖</div>
          <h2>{lang === 'en' ? 'Configure AI First to Generate Meals' : '先配置 AI，再生成专属食谱'}</h2>
          <p>
            {lang === 'en'
              ? 'Enter an API key for DeepSeek, OpenAI, Qwen, or any OpenAI-compatible API in settings to generate customized recipes.'
              : '在设置页填入 DeepSeek / 通义千问 / Kimi / OpenAI 等任意 OpenAI 兼容接口的 Key，AI 会根据你的身高、体重、性别和偏好定制一周减脂餐。'}
          </p>
          <Link id="go-settings" to="/settings" className="btn btn-violet btn-lg">{lang === 'en' ? 'Configure AI in Settings →' : '去设置配置 AI →'}</Link>
        </div>
      )}

      {aiReady && !plan && !generating && (
        <div className="card guide-card">
          <div className="big">🥗</div>
          <h2>{lang === 'en' ? 'No Meal Plan Yet' : '还没有饮食计划'}</h2>
          <p>
            {lang === 'en'
              ? `Daily target: ${info.target} kcal. Click the button above to generate a 7-day home-cooking fat-loss plan (approx. 20–60s).`
              : `每日热量目标 ${info.target} kcal，点击上方按钮，AI 会为你生成 7 天 × 4 餐的家常减脂菜单（约 20–60 秒）。`}
          </p>
        </div>
      )}

      {plan && (
        <div className={`plan-layout ${aiReady && wide ? 'with-chat' : ''}`}>
          <div className="plan-main">
            <div className="plan-head" style={{ marginBottom: 18 }}>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Planned Daily Kcal' : '计划每日热量'}</span>
                <b className="num grad-text">{avgDailyKcal(plan)} kcal</b>
              </div>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Current Target' : '当前热量目标'}</span>
                <b className="num">{info.target} kcal</b>
              </div>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Generated At' : '生成时间'}</span>
                <b className="num" style={{ fontSize: 15 }}>{dayjs(plan.createdAt).format('M/D HH:mm')}</b>
              </div>
              {Math.abs(plan.dailyKcalTarget - info.target) > 100 && (
                <span className="tag tag-slight">
                  {lang === 'en' ? 'Target updated after weight change; consider regenerating.' : '体重变化后热量目标已更新，可考虑重新生成'}
                </span>
              )}
            </div>
            <WeekTable plan={plan} today={today} busyCell={busyCell} aiReady={aiReady} preview={preview} onEdit={(w, k) => setEditing({ w, k })} onSwap={swap} />

            <NutritionCard />

            {getPlanTips(plan, lang).length > 0 && (
              <section className="card mt-24">
                <div className="card-title"><h2>{lang === 'en' ? '💡 Weekly Tips' : '💡 本周要点'}</h2></div>
                <div className="tips">
                  {getPlanTips(plan, lang).map((t, i) => (
                    <div className="tip" key={i}>
                      <span className="tip-no">{i + 1}</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {aiReady && wide && <PlanChat variant="panel" pending={pending} onPending={setPending} />}
        </div>
      )}

      {plan && aiReady && !wide && (
        <>
          <button id="plan-chat-fab" className="chat-fab" onClick={() => setDrawerOpen(true)} aria-label="打开 AI 营养师对话">
            🧑‍🍳<span>{lang === 'en' ? 'Adjust Plan' : '调整食谱'}</span>
            {pending && <i className="chat-fab-dot" />}
          </button>
          <div className={`chat-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
          <PlanChat variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} pending={pending} onPending={setPending} />
        </>
      )}

      <p className="field-hint mt-16" style={{ textAlign: 'center' }}>⚕️ {DISCLAIMER}</p>

      <MealEditModal
        open={!!editing}
        title={editing ? `${getWeekdayLabel(editing.w, lang)} ${getMealLabel(editing.k, lang)}` : ''}
        meal={editingMeal}
        onClose={() => setEditing(null)}
        onSave={(m) => editing && updateMeal(editing.w, editing.k, m)}
      />

      <Modal open={generating} onClose={() => {}} className="loading-card">
        <div className="loading-orb" />
        <h3>{lang === 'en' ? 'AI Dietitian is crafting your meal plan…' : 'AI 营养师正在为你定制食谱…'}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {lang === 'en' ? 'Calculating 7 days × 4 meals from your physical data, usually takes 20–60s' : '根据你的身体数据计算 7 天 × 4 餐，通常需要 20–60 秒'}
        </p>
      </Modal>
    </>
  );
}
