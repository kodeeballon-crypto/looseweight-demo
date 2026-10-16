import dayjs from 'dayjs';
import { chat, isAiConfigured } from '../ai/client';
import { encouragementMessages } from '../ai/prompts';
import { parseEncouragement } from '../ai/parse';
import { energyInfo, intakeOf, kcalStatus, movingAverage7, round1, sortRecords } from '../domain/calc';
import { calcStreak } from '../domain/badges';
import { offlineEncouragement } from '../domain/encourage';
import type { DailyRecord, Profile, Settings, WeekPlan } from '../types';
import { getLang } from '../i18n';
import type { Lang } from '../i18n/types';

export const todayStr = () => dayjs().format('YYYY-MM-DD');

interface Input {
  profile: Profile;
  records: DailyRecord[];
  plan: WeekPlan | null;
  settings: Settings;
  date: string;
  newMilestone: boolean;
  lang?: Lang;
}

export interface EncourageResult {
  text: string;
  source: 'ai' | 'offline';
  error?: string;
}

/** 生成某天的鼓励语：已配置 AI 时调用 AI，失败或未配置则走离线语料 */
export async function generateEncouragement({ profile, records, plan, settings, date, newMilestone, lang = getLang() }: Input): Promise<EncourageResult> {
  const sorted = sortRecords(records).filter((r) => r.date <= date);
  const today = sorted.at(-1);
  if (!today) return { text: '', source: 'offline' };
  const prev = sorted.at(-2);
  const delta = prev ? round1(today.weightKg - prev.weightKg) : null;
  const streak = calcStreak(sorted, date);
  const target = energyInfo(profile, sorted).target;
  const hasMeals = today.mealsEaten.length > 0 || (today.extraKcal ?? 0) > 0;
  const kcal = hasMeals ? kcalStatus(intakeOf(today, plan).kcal, target) : null;
  const totalLoss = round1(profile.startWeightKg - today.weightKg);

  const offline = () =>
    offlineEncouragement({ isFirst: sorted.length === 1, delta, streak, kcal, newMilestone, totalLoss }, Math.random, lang);

  if (!isAiConfigured(settings)) return { text: offline(), source: 'offline' };

  const from = dayjs(date).subtract(13, 'day').format('YYYY-MM-DD');
  const recent = sorted.filter((r) => r.date >= from);
  const avg = movingAverage7(sorted);
  const avgToday = avg.at(-1)?.avg;
  const weekAgo = dayjs(date).subtract(7, 'day').format('YYYY-MM-DD');
  const avgPrev = [...avg].reverse().find((a) => a.date <= weekAgo)?.avg;
  const avgTrend = avgToday !== undefined && avgPrev !== undefined ? round1(avgToday - avgPrev) : null;

  try {
    const raw = await chat(
      settings,
      encouragementMessages(profile, { recent, delta, avgTrend, kcal, streak, totalLoss, targetWeight: profile.targetWeightKg }, lang),
      { timeoutMs: 20000, json: true, temperature: 0.9 },
    );
    return { text: parseEncouragement(raw), source: 'ai' };
  } catch (e) {
    return { text: offline(), source: 'offline', error: e instanceof Error ? e.message : String(e) };
  }
}
