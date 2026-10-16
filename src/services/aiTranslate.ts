import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { chat, isAiConfigured } from '../ai/client';
import { extractJson, parseEncouragement } from '../ai/parse';
import { weekdayOf } from '../domain/calc';
import { useT } from '../i18n';
import { useStore } from '../store/useStore';
import {
  MEAL_KEYS,
  hasCjk,
  type DayPlan,
  type Meal,
  type MealKey,
  type NutritionAnalysis,
  type Settings,
  type WeekPlan,
  type WorkoutPlan,
} from '../types';
import { generateEncouragement, todayStr } from './encourage';

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
      { timeoutMs: 25000, json: true, temperature: 0.4 },
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
      { timeoutMs: 25000, json: true, temperature: 0.3 },
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

/** 调用 AI 将整周中文饮食计划（7 天 × 4 餐 + 本周要点）翻译为英文 */
export async function translateWeekPlanToEn(settings: Settings, plan: WeekPlan): Promise<WeekPlan | null> {
  if (!isAiConfigured(settings)) return null;
  const daysToTranslate = plan.days.filter((d) =>
    MEAL_KEYS.some((k) => (!d.meals[k].nameEn && hasCjk(d.meals[k].name)) || (!d.meals[k].itemsEn && hasCjk(d.meals[k].items))),
  );
  const tipsNeedTrans = Boolean(plan.tips?.length && (!plan.tipsEn || plan.tipsEn.length === 0) && plan.tips.some((t) => hasCjk(t)));
  if (daysToTranslate.length === 0 && !tipsNeedTrans) return null;

  const inputPayload = {
    days: daysToTranslate.map((d) => ({
      weekday: d.weekday,
      meals: Object.fromEntries(MEAL_KEYS.map((k) => [k, { name: d.meals[k].name, items: d.meals[k].items }])),
    })),
    tips: tipsNeedTrans ? plan.tips : undefined,
  };

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
      { timeoutMs: 60000, json: true, temperature: 0.3 },
    );
    const data = extractJson(raw) as Record<string, unknown>;
    const rawDays = Array.isArray(data?.days) ? data.days : [];
    const byWeekday = new Map<number, Record<string, unknown>>();
    for (const d of rawDays) {
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        const w = Number(o.weekday);
        if (w >= 1 && w <= 7 && o.meals && typeof o.meals === 'object') {
          byWeekday.set(w, o.meals as Record<string, unknown>);
        }
      }
    }

    const latestPlan = useStore.getState().plan ?? plan;
    const nextDays: DayPlan[] = latestPlan.days.map((d) => {
      const trMeals = byWeekday.get(d.weekday);
      if (!trMeals) return d;
      const meals = { ...d.meals };
      for (const k of MEAL_KEYS) {
        const m = trMeals[k] as Record<string, unknown> | undefined;
        const nameEn = typeof m?.name === 'string' ? m.name.trim() : '';
        const itemsEn = typeof m?.items === 'string' ? m.items.trim() : '';
        if (nameEn) {
          meals[k] = {
            ...meals[k],
            nameEn: meals[k].nameEn || nameEn,
            itemsEn: meals[k].itemsEn || itemsEn || meals[k].items,
          };
        }
      }
      return { ...d, meals };
    });

    const tipsEn = Array.isArray(data?.tips)
      ? data.tips.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
      : latestPlan.tipsEn;

    return {
      ...latestPlan,
      days: nextDays,
      ...(tipsEn && tipsEn.length > 0 ? { tipsEn } : {}),
    };
  } catch {
    return null;
  }
}

/** 调用 AI 将整周中文训练计划（7 天重点、动作名称与要点、本周提示）翻译为英文 */
export async function translateWorkoutPlanToEn(settings: Settings, plan: WorkoutPlan): Promise<WorkoutPlan | null> {
  if (!isAiConfigured(settings)) return null;
  const inputPayload = {
    days: plan.days.map((d) => ({
      weekday: d.weekday,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({ id: e.id, name: e.name, detail: e.detail })),
    })),
    tips: plan.tips,
  };

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
      { timeoutMs: 45000, json: true, temperature: 0.3 },
    );
    const data = extractJson(raw) as Record<string, unknown>;
    const rawDays = Array.isArray(data?.days) ? data.days : [];
    const byWeekday = new Map<number, Record<string, unknown>>();
    for (const d of rawDays) {
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        byWeekday.set(Number(o.weekday), o);
      }
    }

    const latest = useStore.getState().workoutPlan ?? plan;
    const nextDays = latest.days.map((d) => {
      const tr = byWeekday.get(d.weekday);
      if (!tr) return d;
      const focusEn = typeof tr.focus === 'string' && tr.focus.trim() ? tr.focus.trim() : d.focusEn;
      const trExList = Array.isArray(tr.exercises) ? tr.exercises : [];
      const exMap = new Map<string, { name: string; detail: string }>();
      trExList.forEach((rawEx, idx) => {
        if (rawEx && typeof rawEx === 'object') {
          const eo = rawEx as Record<string, unknown>;
          const id = typeof eo.id === 'string' ? eo.id : d.exercises[idx]?.id;
          const name = typeof eo.name === 'string' ? eo.name.trim() : '';
          const detail = typeof eo.detail === 'string' ? eo.detail.trim() : '';
          if (id && name) exMap.set(id, { name, detail });
        }
      });
      return {
        ...d,
        ...(focusEn ? { focusEn } : {}),
        exercises: d.exercises.map((e) => {
          const hit = exMap.get(e.id);
          return hit ? { ...e, nameEn: e.nameEn || hit.name, detailEn: e.detailEn || hit.detail } : e;
        }),
      };
    });

    const tipsEn = Array.isArray(data?.tips)
      ? data.tips.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
      : latest.tipsEn;

    return {
      ...latest,
      days: nextDays,
      ...(tipsEn && tipsEn.length > 0 ? { tipsEn } : {}),
    };
  } catch {
    return null;
  }
}

/** 调用 AI 将营养分析点评与建议翻译为英文 */
export async function translateNutritionToEn(settings: Settings, analysis: NutritionAnalysis): Promise<NutritionAnalysis | null> {
  if (!isAiConfigured(settings)) return null;
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
      { timeoutMs: 25000, json: true, temperature: 0.3 },
    );
    const data = extractJson(raw) as Record<string, unknown>;
    const summaryEn = typeof data?.summary === 'string' ? data.summary.trim() : '';
    const suggestionsEn = Array.isArray(data?.suggestions)
      ? data.suggestions.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim())
      : [];
    if (!summaryEn) return null;
    return {
      ...analysis,
      summaryEn,
      ...(suggestionsEn.length > 0 ? { suggestionsEn } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * 全局自动同步 Hook：当切换到英文 (en) 时，自动通过 DeepSeek 将已有的中文鼓励语、今日食谱、整周饮食计划、训练周表、营养点评转换为英文并缓存
 */
export function useAiTranslateSync() {
  const { lang } = useT();
  const { profile, records, plan, workoutPlan, nutritionCache, settings, setEncouragement, updateMeal, setPlan, setWorkoutPlan, setNutrition } =
    useStore();
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

    const sig = `${today}-${todayRec.weightKg}-${todayRec.encouragement ?? ''}`;
    if (encKeyRef.current === sig) return;
    encKeyRef.current = sig;

    setFlag('encouragement', true);
    void (async () => {
      try {
        if (todayRec.encouragement && hasCjk(todayRec.encouragement) && isAiConfigured(settings)) {
          const translated = await translateEncouragementToEn(settings, todayRec.encouragement);
          if (translated) {
            setEncouragement(today, translated, 'en');
            return;
          }
        }
        const s = useStore.getState();
        const res = await generateEncouragement({ ...s, profile, date: today, newMilestone: false, lang: 'en' });
        if (res.text) setEncouragement(today, res.text, 'en');
      } finally {
        setFlag('encouragement', false);
      }
    })();
  }, [lang, profile, today, todayRec, settings, setEncouragement, setFlag]);

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

    const sig = `${plan.createdAt}-${todayDayPlan ? MEAL_KEYS.map((k) => todayDayPlan.meals[k].name).join('|') : ''}`;
    if (dayMealKeyRef.current === sig && weekPlanKeyRef.current === sig) return;

    setFlag('meals', true);
    void (async () => {
      try {
        if (todayNeeds && todayDayPlan && dayMealKeyRef.current !== sig) {
          dayMealKeyRef.current = sig;
          const tr = await translateDayMealsToEn(settings, todayDayPlan.meals);
          for (const k of MEAL_KEYS) {
            const hit = tr[k];
            if (hit) {
              const cur = useStore.getState().plan?.days.find((d) => d.weekday === todayWeekday)?.meals[k];
              if (cur) updateMeal(todayWeekday, k, { ...cur, nameEn: hit.nameEn, itemsEn: hit.itemsEn });
            }
          }
        }
        const latestPlan = useStore.getState().plan;
        if (latestPlan && weekPlanKeyRef.current !== sig) {
          weekPlanKeyRef.current = sig;
          const fullTranslated = await translateWeekPlanToEn(settings, latestPlan);
          if (fullTranslated) setPlan(fullTranslated);
        }
      } finally {
        setFlag('meals', false);
      }
    })();
  }, [lang, plan, todayDayPlan, todayWeekday, settings, updateMeal, setPlan, setFlag]);

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
    if (workoutKeyRef.current === workoutPlan.createdAt) return;
    workoutKeyRef.current = workoutPlan.createdAt;

    setFlag('workout', true);
    void translateWorkoutPlanToEn(settings, workoutPlan)
      .then((next) => {
        if (next) setWorkoutPlan(next);
      })
      .finally(() => setFlag('workout', false));
  }, [lang, workoutPlan, settings, setWorkoutPlan, setFlag]);

  // 4. 自动转换今日营养结构分析
  useEffect(() => {
    if (lang !== 'en' || !todayNutri || !isAiConfigured(settings)) return;
    if (todayNutri.summaryEn || !hasCjk(todayNutri.summary)) return;
    const sig = `${todayNutri.date}-${todayNutri.signature}`;
    if (nutriKeyRef.current === sig) return;
    nutriKeyRef.current = sig;

    setFlag('nutrition', true);
    void translateNutritionToEn(settings, todayNutri)
      .then((next) => {
        if (next) setNutrition(next);
      })
      .finally(() => setFlag('nutrition', false));
  }, [lang, todayNutri, settings, setNutrition, setFlag]);
}

