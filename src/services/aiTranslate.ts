import { useEffect, useRef } from 'react';
import { AI_TEMPERATURE, AI_TIMEOUT } from '../config/ai';
import { create } from 'zustand';
import { chat, isAiConfigured } from '../ai/client';
import { extractJson, parseEncouragement } from '../ai/parse';
import { weekdayOf } from '../domain/calc';
import { useT } from '../i18n';
import { useStore } from '../store/useStore';
import {
  MEAL_KEYS,
  hasCjk,
  type Meal,
  type MealKey,
  type NutritionAnalysis,
  type Settings,
  type WeekPlan,
  type WorkoutPlan,
} from '../types';
import { generateEncouragement, todayStr } from './encourage';
import {
  applyDayMealTranslation,
  applyNutritionTranslation,
  applyWeekPlanTranslation,
  applyWorkoutTranslation,
  weekPlanSource,
  workoutSource,
} from './translateMerge';

interface TranslateStatus {
  encouragement: boolean;
  meals: boolean;
  workout: boolean;
  nutrition: boolean;
  setFlag: (k: 'encouragement' | 'meals' | 'workout' | 'nutrition', v: boolean) => void;
}

export const useTranslateStatus = create<TranslateStatus>((set) => ({
  encouragement: false,
  meals: false,
  workout: false,
  nutrition: false,
  setFlag: (k, v) => set({ [k]: v }),
}));

/** 调用 AI 将已生成的中文打卡鼓励语翻译成英文 */
export async function translateEncouragementToEn(settings: Settings, zhText: string): Promise<string | null> {
  if (!isAiConfigured(settings) || !zhText.trim()) return null;
  try {
    const raw = await chat(
      settings,
      [
        {
          role: 'system',
          content:
            'You are a warm, supportive bilingual weight-loss coach. Translate the Chinese encouragement message into natural, idiomatic English. Preserve all specific numbers, dates, weights (kg), streak days, and emojis. Return ONLY valid JSON: {"text": "..."}',
        },
        {
          role: 'user',
          content: `Translate the following encouragement message into English:\n\n${zhText}\n\nReturn JSON only: { "text": "English translation" }`,
        },
      ],
      { timeoutMs: AI_TIMEOUT.translateShort, json: true, temperature: AI_TEMPERATURE.translateEncourage },
    );
    return parseEncouragement(raw);
  } catch {
    return null;
  }
}

/** 调用 AI 将单日四餐（早餐/午餐/晚餐/加餐）的中文名称和份量翻译为英文 */
export async function translateDayMealsToEn(
  settings: Settings,
  meals: Record<MealKey, Meal>,
): Promise<Partial<Record<MealKey, { nameEn: string; itemsEn: string }>>> {
  if (!isAiConfigured(settings)) return {};
  const payload = Object.fromEntries(MEAL_KEYS.map((k) => [k, { name: meals[k].name, items: meals[k].items }]));
  try {
    const raw = await chat(
      settings,
      [
        {
          role: 'system',
          content:
            'You are a bilingual registered dietitian. Translate the Chinese meal names and ingredient portions into concise, natural English. Keep all gram/ml/piece amounts and ordering notes accurate. Return ONLY valid JSON without markdown.',
        },
        {
          role: 'user',
          content: `Translate the following 4 meals into concise English:\n${JSON.stringify(payload)}\n\nOutput JSON format:\n{"breakfast":{"name":"...","items":"..."},"lunch":{"name":"...","items":"..."},"dinner":{"name":"...","items":"..."},"snack":{"name":"...","items":"..."}}`,
        },
      ],
      { timeoutMs: AI_TIMEOUT.translateShort, json: true, temperature: AI_TEMPERATURE.translate },
    );
    const data = extractJson(raw) as Record<string, unknown>;
    const out: Partial<Record<MealKey, { nameEn: string; itemsEn: string }>> = {};
    for (const k of MEAL_KEYS) {
      const m = data?.[k] as Record<string, unknown> | undefined;
      const nameEn = typeof m?.name === 'string' ? m.name.trim() : '';
      const itemsEn = typeof m?.items === 'string' ? m.items.trim() : '';
      if (nameEn) out[k] = { nameEn, itemsEn: itemsEn || meals[k].items };
    }
    return out;
  } catch {
    return {};
  }
}

/** 调用 AI 将整周中文饮食计划（7 天 × 4 餐 + 本周要点）翻译为英文；只写入原文仍一致的条目 */
export async function translateWeekPlanToEn(settings: Settings, plan: WeekPlan): Promise<WeekPlan | null> {
  if (!isAiConfigured(settings)) return null;
  const daysToTranslate = plan.days.filter((d) =>
    MEAL_KEYS.some((k) => (!d.meals[k].nameEn && hasCjk(d.meals[k].name)) || (!d.meals[k].itemsEn && hasCjk(d.meals[k].items))),
  );
  const tipsNeedTrans = Boolean(plan.tips?.length && (!plan.tipsEn || plan.tipsEn.length === 0) && plan.tips.some((t) => hasCjk(t)));
  if (daysToTranslate.length === 0 && !tipsNeedTrans) return null;

  const source = weekPlanSource(plan, daysToTranslate.map((d) => d.weekday));
  const inputPayload = { days: source.days, tips: tipsNeedTrans ? source.tips : undefined };
  if (!tipsNeedTrans) delete source.tips;

  try {
    const raw = await chat(
      settings,
      [
        {
          role: 'system',
          content:
            'You are a bilingual registered dietitian. Translate all Chinese meal names, ingredient portions, and weekly tips into concise, natural English. Preserve all weekday numbers, meal keys, and gram/ml portions. Return ONLY valid JSON without markdown.',
        },
        {
          role: 'user',
          content: `Translate this meal plan data into English:\n${JSON.stringify(inputPayload)}\n\nReturn JSON with the exact same structure: {"days":[{"weekday":1,"meals":{"breakfast":{"name":"...","items":"..."},"lunch":{"name":"...","items":"..."},"dinner":{"name":"...","items":"..."},"snack":{"name":"...","items":"..."}}}],"tips":["..."]}`,
        },
      ],
      { timeoutMs: AI_TIMEOUT.translateWeek, json: true, temperature: AI_TEMPERATURE.translate },
    );
    // 以响应到达时的最新计划为准；计划被清空/修改的部分会被丢弃
    return applyWeekPlanTranslation(useStore.getState().plan, source, extractJson(raw));
  } catch {
    return null;
  }
}

/** 调用 AI 将整周中文训练计划（7 天重点、动作名称与要点、本周提示）翻译为英文；只写入原文仍一致的条目 */
export async function translateWorkoutPlanToEn(settings: Settings, plan: WorkoutPlan): Promise<WorkoutPlan | null> {
  if (!isAiConfigured(settings)) return null;
  const source = workoutSource(plan);
  const inputPayload = source;

  try {
    const raw = await chat(
      settings,
      [
        {
          role: 'system',
          content:
            'You are a bilingual certified fitness coach. Translate the Chinese workout plan (focus, exercise names, sets/reps/duration details, and tips) into concise, natural English. Preserve all weekday numbers and exercise IDs. Return ONLY valid JSON without markdown.',
        },
        {
          role: 'user',
          content: `Translate this workout plan into English:\n${JSON.stringify(inputPayload)}\n\nReturn JSON with the exact same structure: {"days":[{"weekday":1,"focus":"...","exercises":[{"id":"...","name":"...","detail":"..."}]}],"tips":["..."]}`,
        },
      ],
      { timeoutMs: AI_TIMEOUT.translateWorkout, json: true, temperature: AI_TEMPERATURE.translate },
    );
    return applyWorkoutTranslation(useStore.getState().workoutPlan, source, extractJson(raw));
  } catch {
    return null;
  }
}

/** 调用 AI 将营养分析点评与建议翻译为英文；只在缓存仍是同一次分析时写入 */
export async function translateNutritionToEn(settings: Settings, analysis: NutritionAnalysis): Promise<NutritionAnalysis | null> {
  if (!isAiConfigured(settings)) return null;
  const source = { date: analysis.date, signature: analysis.signature, summary: analysis.summary, suggestions: [...analysis.suggestions] };
  try {
    const raw = await chat(
      settings,
      [
        {
          role: 'system',
          content:
            'You are a bilingual nutritionist. Translate the Chinese diet nutrition summary and suggestions into concise, natural English. Return ONLY valid JSON: {"summary":"...","suggestions":["..."]}',
        },
        {
          role: 'user',
          content: `Translate into English:\n${JSON.stringify({ summary: analysis.summary, suggestions: analysis.suggestions })}`,
        },
      ],
      { timeoutMs: AI_TIMEOUT.translateShort, json: true, temperature: AI_TEMPERATURE.translate },
    );
    const data = extractJson(raw) as Record<string, unknown>;
    const summaryEn = typeof data?.summary === 'string' ? data.summary.trim() : '';
    const suggestionsEn = Array.isArray(data?.suggestions)
      ? data.suggestions.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim())
      : [];
    return applyNutritionTranslation(useStore.getState().nutritionCache[analysis.date], source, { summaryEn, suggestionsEn });
  } catch {
    return null;
  }
}

/** 内容签名：原文任何变化都会触发重新翻译（不再只依赖 createdAt） */
const mealPlanSig = (p: WeekPlan) =>
  JSON.stringify([p.createdAt, p.days.map((d) => [d.weekday, MEAL_KEYS.map((k) => [d.meals[k].name, d.meals[k].items])]), p.tips ?? []]);
const workoutSig = (p: WorkoutPlan) =>
  JSON.stringify([p.createdAt, p.days.map((d) => [d.weekday, d.focus, d.exercises.map((e) => [e.id, e.name, e.detail])]), p.tips ?? []]);

/**
 * 全局自动同步 Hook：当切换到英文 (en) 时，自动通过 DeepSeek 将已有的中文鼓励语、今日食谱、整周饮食计划、训练周表、营养点评转换为英文并缓存。
 * 所有回写都会先核对“原文是否仍与发送时一致”，过期响应直接丢弃；失败后清除签名，下次数据或语言变化时可重试。
 */
export function useAiTranslateSync() {
  const { lang } = useT();
  const { profile, records, plan, workoutPlan, nutritionCache, settings, setPlan, setWorkoutPlan, setNutrition } = useStore();
  const setFlag = useTranslateStatus((s) => s.setFlag);

  const encKeyRef = useRef('');
  const dayMealKeyRef = useRef('');
  const weekPlanKeyRef = useRef('');
  const workoutKeyRef = useRef('');
  const nutriKeyRef = useRef('');

  const today = todayStr();
  const todayWeekday = weekdayOf(today);
  const todayRec = records.find((r) => r.date === today);
  const todayDayPlan = plan?.days.find((d) => d.weekday === todayWeekday);
  const todayNutri = nutritionCache[today];

  // 1. 自动转换今日鼓励语（优先把 DeepSeek 已生成的中文鼓励语翻译为英文）
  useEffect(() => {
    if (!profile || !todayRec || lang !== 'en') return;
    const hasEn = Boolean(todayRec.encouragementEn?.trim() || (todayRec.encouragement?.trim() && !hasCjk(todayRec.encouragement)));
    if (hasEn) return;

    const sourceZh = todayRec.encouragement ?? '';
    const sig = `${today}-${todayRec.weightKg}-${sourceZh}`;
    if (encKeyRef.current === sig) return;
    encKeyRef.current = sig;

    /** 回写前核对：记录仍在、中文原文未变、且尚无英文 */
    const stillValid = () => {
      const cur = useStore.getState().records.find((r) => r.date === today);
      return !!cur && (cur.encouragement ?? '') === sourceZh && !cur.encouragementEn?.trim();
    };

    setFlag('encouragement', true);
    void (async () => {
      let ok = false;
      try {
        if (sourceZh && hasCjk(sourceZh) && isAiConfigured(settings)) {
          const translated = await translateEncouragementToEn(settings, sourceZh);
          if (translated && stillValid()) {
            useStore.getState().setEncouragement(today, translated, 'en');
            ok = true;
            return;
          }
        }
        const s = useStore.getState();
        const res = await generateEncouragement({ ...s, profile, date: today, newMilestone: false, lang: 'en' });
        if (res.text && stillValid()) {
          useStore.getState().setEncouragement(today, res.text, 'en');
          ok = true;
        }
      } finally {
        if (!ok && encKeyRef.current === sig) encKeyRef.current = '';
        setFlag('encouragement', false);
      }
    })();
  }, [lang, profile, today, todayRec, settings, setFlag]);

  // 2. 自动转换今日四餐（快速响应今日页面，再后台补齐整周食谱）
  useEffect(() => {
    if (lang !== 'en' || !plan || !isAiConfigured(settings)) return;

    const todayNeeds =
      todayDayPlan &&
      MEAL_KEYS.some((k) => (!todayDayPlan.meals[k].nameEn && hasCjk(todayDayPlan.meals[k].name)) || (!todayDayPlan.meals[k].itemsEn && hasCjk(todayDayPlan.meals[k].items)));

    const weekNeeds =
      plan.days.some((d) =>
        MEAL_KEYS.some((k) => (!d.meals[k].nameEn && hasCjk(d.meals[k].name)) || (!d.meals[k].itemsEn && hasCjk(d.meals[k].items))),
      ) || Boolean(plan.tips?.length && (!plan.tipsEn || plan.tipsEn.length === 0) && plan.tips.some((t) => hasCjk(t)));

    if (!todayNeeds && !weekNeeds) return;

    const sig = mealPlanSig(plan);
    if (dayMealKeyRef.current === sig && weekPlanKeyRef.current === sig) return;

    setFlag('meals', true);
    void (async () => {
      try {
        if (todayNeeds && todayDayPlan && dayMealKeyRef.current !== sig) {
          dayMealKeyRef.current = sig;
          const source = weekPlanSource(plan, [todayWeekday]).days[0]?.meals ?? {};
          const tr = await translateDayMealsToEn(settings, todayDayPlan.meals);
          const merged = applyDayMealTranslation(useStore.getState().plan, todayWeekday, source, tr);
          if (merged) setPlan(merged);
          else if (Object.keys(tr).length === 0 && dayMealKeyRef.current === sig) dayMealKeyRef.current = '';
        }
        const latestPlan = useStore.getState().plan;
        if (latestPlan && weekPlanKeyRef.current !== sig) {
          weekPlanKeyRef.current = sig;
          const fullTranslated = await translateWeekPlanToEn(settings, latestPlan);
          if (fullTranslated) setPlan(fullTranslated);
          else if (weekPlanKeyRef.current === sig) weekPlanKeyRef.current = '';
        }
      } finally {
        setFlag('meals', false);
      }
    })();
  }, [lang, plan, todayDayPlan, todayWeekday, settings, setPlan, setFlag]);

  // 3. 自动转换训练周表
  useEffect(() => {
    if (lang !== 'en' || !workoutPlan || !isAiConfigured(settings)) return;
    const needs =
      workoutPlan.days.some(
        (d) =>
          (!d.focusEn && hasCjk(d.focus)) ||
          d.exercises.some((e) => (!e.nameEn && hasCjk(e.name)) || (!e.detailEn && hasCjk(e.detail))),
      ) || Boolean(workoutPlan.tips?.length && (!workoutPlan.tipsEn || workoutPlan.tipsEn.length === 0) && workoutPlan.tips.some((t) => hasCjk(t)));

    if (!needs) return;
    const sig = workoutSig(workoutPlan);
    if (workoutKeyRef.current === sig) return;
    workoutKeyRef.current = sig;

    setFlag('workout', true);
    void translateWorkoutPlanToEn(settings, workoutPlan)
      .then((next) => {
        if (next) setWorkoutPlan(next);
        else if (workoutKeyRef.current === sig) workoutKeyRef.current = '';
      })
      .finally(() => setFlag('workout', false));
  }, [lang, workoutPlan, settings, setWorkoutPlan, setFlag]);

  // 4. 自动转换今日营养结构分析
  useEffect(() => {
    if (lang !== 'en' || !todayNutri || !isAiConfigured(settings)) return;
    if (todayNutri.summaryEn || !hasCjk(todayNutri.summary)) return;
    const sig = `${todayNutri.date}-${todayNutri.signature}-${todayNutri.summary}`;
    if (nutriKeyRef.current === sig) return;
    nutriKeyRef.current = sig;

    setFlag('nutrition', true);
    void translateNutritionToEn(settings, todayNutri)
      .then((next) => {
        if (next) setNutrition(next);
        else if (nutriKeyRef.current === sig) nutriKeyRef.current = '';
      })
      .finally(() => setFlag('nutrition', false));
  }, [lang, todayNutri, settings, setNutrition, setFlag]);
}

