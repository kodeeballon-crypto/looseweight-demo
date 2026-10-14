import { useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { bmiLevel, computeStats, energyInfo, getKcalStatusLabel, intakeOf, kcalStatus, weekdayOf } from '../domain/calc';
import { burnedOn, dayBurn, netIntake } from '../domain/workout';
import { calcStreak, newBadges, unlockedBadges } from '../domain/badges';
import { generateEncouragement, todayStr } from '../services/encourage';
import { isAiConfigured } from '../ai/client';
import MetricCard from '../components/MetricCard';
import CheckInForm, { type CheckInValues } from '../components/CheckInForm';
import KcalRing from '../components/KcalRing';
import GoalProgress from '../components/GoalProgress';
import TodayProgress from '../components/TodayProgress';
import { showBadges } from '../components/BadgePopup';
import { useT } from '../i18n';
import type { Lang } from '../i18n/types';

const BMI_COLOR = { under: '#228be6', normal: '#0ca678', over: '#e67700', obese: '#e03131' } as const;
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function greeting(lang: Lang) {
  const h = new Date().getHours();
  if (lang === 'en') {
    if (h < 6) return 'Late night, get some rest 🌙';
    if (h < 11) return 'Good morning ☀️';
    if (h < 14) return 'Good noon 🍱';
    if (h < 18) return 'Good afternoon 🌤️';
    return 'Good evening 🌆';
  }
  if (h < 6) return '夜深了，早点休息 🌙';
  if (h < 11) return '早上好 ☀️';
  if (h < 14) return '中午好 🍱';
  if (h < 18) return '下午好 🌤️';
  return '晚上好 🌆';
}

export default function Dashboard() {
  const { profile, records, plan, settings, seenBadges, workoutPlan, workoutLog, upsertRecord, setEncouragement } = useStore();
  const [genBusy, setGenBusy] = useState(false);
  const { t, lang } = useT();

  if (!profile) return null;

  const today = todayStr();
  const todayRec = records.find((r) => r.date === today);
  const info = energyInfo(profile, records);
  const stats = computeStats(profile, records, plan, info.target, workoutLog);
  const streak = calcStreak(records, today);
  const level = bmiLevel(info.bmi, lang);
  const intake = intakeOf(todayRec ?? { date: today, mealsEaten: [] }, plan).kcal;
  const burned = burnedOn(workoutLog, today);
  const net = netIntake(intake, burned);
  const status = kcalStatus(net, info.target);
  const todayWorkout = workoutPlan?.days.find((d) => d.weekday === weekdayOf(today));
  const doneIds = new Set((workoutLog[today] ?? []).map((e) => e.id));
  const doneCount = todayWorkout ? todayWorkout.exercises.filter((e) => doneIds.has(e.id)).length : 0;

  const runEncourage = async (newMilestone: boolean) => {
    const s = useStore.getState();
    setGenBusy(true);
    const res = await generateEncouragement({ ...s, profile, date: today, newMilestone });
    setGenBusy(false);
    if (res.text) setEncouragement(today, res.text);
    if (res.error) toast(lang === 'en' ? `AI encourage failed, used offline template: ${res.error}` : `AI 鼓励生成失败，已使用内置鼓励：${res.error}`, 'error');
  };

  const onSubmit = async (v: CheckInValues) => {
    const first = !todayRec;
    upsertRecord({ ...v, encouragement: todayRec?.encouragement });
    toast(first ? (lang === 'en' ? 'Check-in saved!' : '打卡成功！') : (lang === 'en' ? 'Updated today’s check-in' : '已更新今日打卡'), 'success');

    const after = useStore.getState().records;
    const fresh = newBadges(unlockedBadges(profile, after, today, lang), seenBadges);
    showBadges(fresh);
    if (!todayRec?.encouragement) await runEncourage(fresh.length > 0);
  };

  const dateSub = lang === 'en'
    ? `${dayjs().format('MMM D')} · ${dayjs().format('dddd')} · ${todayRec ? 'Checked in today ✅' : 'Not checked in yet'}`
    : `${dayjs().format('M 月 D 日')} · 星期${WEEK_ZH[dayjs().day()]} · ${todayRec ? '今天已经打过卡啦 ✅' : '今天还没打卡哦'}`;

  return (
    <>
      <div className="hero">
        <div>
          <h1>{greeting(lang)}</h1>
          <p>{dateSub}</p>
        </div>
        <div className="streak-chip" id="streak-chip">
          <span className="flame">🔥</span> {t('common.streakDays', { n: streak })}
        </div>
      </div>

      <div className="grid grid-4">
        <MetricCard
          id="m-weight"
          label={lang === 'en' ? '⚖️ Current Weight' : '⚖️ 当前体重'}
          value={info.weightKg}
          unit="kg"
          accent="#ff7849"
          foot={stats.change7d !== null ? (lang === 'en' ? `Last 7d ${stats.change7d > 0 ? '+' : ''}${stats.change7d} kg` : `近 7 天 ${stats.change7d > 0 ? '+' : ''}${stats.change7d} kg`) : (lang === 'en' ? 'Changes show after logging' : '开始记录后显示变化')}
        />
        <MetricCard
          id="m-loss"
          label={lang === 'en' ? '📉 Total Loss' : '📉 累计减重'}
          value={stats.totalLoss > 0 ? stats.totalLoss : 0}
          unit="kg"
          accent="#12b886"
          delay={60}
          foot={lang === 'en' ? `Start ${profile.startWeightKg} kg` : `初始 ${profile.startWeightKg} kg`}
        />
        <MetricCard
          id="m-bmi"
          label="🧮 BMI"
          accent={BMI_COLOR[level.key]}
          delay={120}
          value={<span style={{ color: BMI_COLOR[level.key] }}>{info.bmi.toFixed(1)}</span>}
          foot={<span className="tag" style={{ color: BMI_COLOR[level.key] }}>{level.label}</span>}
        />
        <MetricCard
          id="m-streak"
          label={lang === 'en' ? '🔥 Streak' : '🔥 连续打卡'}
          value={streak}
          unit={t('common.unitDays')}
          accent="#f59f00"
          delay={180}
          foot={lang === 'en' ? `Daily target ${info.target} kcal` : `每日热量目标 ${info.target} kcal`}
        />
      </div>

      <div className="grid dash-main mt-24">
        <section className="card" style={{ animationDelay: '120ms' }}>
          <div className="card-title">
            <h2>{lang === 'en' ? '✍️ Daily Check-in' : '✍️ 今日打卡'}</h2>
            <span className="card-sub">{today}</span>
          </div>
          {todayRec && <div className="checked-banner">{lang === 'en' ? '✅ Checked in today. Feel free to update and re-save anytime.' : '✅ 今日已打卡，可以随时修改后重新保存'}</div>}
          <CheckInForm
            key={todayRec ? `edit-${today}` : `new-${today}`}
            date={today}
            initial={todayRec}
            plan={plan}
            busy={genBusy}
            submitLabel={todayRec ? (lang === 'en' ? 'Update Check-in' : '更新打卡') : (lang === 'en' ? 'Check In 💪' : '打卡 💪')}
            onSubmit={onSubmit}
          />
        </section>

        <div className="stack">
          <section className="card encourage" style={{ animationDelay: '180ms' }}>
            <div className="card-title">
              <h2>{lang === 'en' ? '💌 A Word For You' : '💌 给你的话'}</h2>
              {todayRec && (
                <button id="encourage-refresh" className="btn btn-sm btn-ghost" disabled={genBusy} onClick={() => runEncourage(false)}>
                  {genBusy ? <span className="spinner" /> : '🔄'} {lang === 'en' ? 'Shuffle' : '换一句'}
                </button>
              )}
            </div>
            {genBusy && !todayRec?.encouragement ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="skeleton" style={{ height: 16 }} />
                <div className="skeleton" style={{ height: 16, width: '85%' }} />
                <div className="skeleton" style={{ height: 16, width: '60%' }} />
              </div>
            ) : todayRec?.encouragement ? (
              <p className="encourage-text" key={todayRec.encouragement} style={{ margin: 0 }}>
                {todayRec.encouragement}
              </p>
            ) : (
              <p className="encourage-empty" style={{ margin: 0 }}>
                {t('dashboard.emptyEncourage')}
                {!isAiConfigured(settings) && (
                  <span className="field-hint" style={{ display: 'block', marginTop: 8 }}>
                    {lang === 'en' ? (
                      <>（Offline template used when AI not configured, <Link to="/settings">configure here</Link>）</>
                    ) : (
                      <>（未配置 AI 时使用内置鼓励语，<Link to="/settings">去配置</Link>）</>
                    )}
                  </span>
                )}
              </p>
            )}
          </section>

          <section className="card" style={{ animationDelay: '240ms' }}>
            <div className="card-title">
              <h2>{lang === 'en' ? '🔥 Today’s Calories' : '🔥 今日热量'}</h2>
              <span className={`tag tag-${status}`}>
                {intake === 0 && burned === 0 ? (lang === 'en' ? 'No Log' : '未记录') : getKcalStatusLabel(status, lang)}
              </span>
            </div>
            <KcalRing intake={net} target={info.target} status={status} burned={burned} burnPlan={todayWorkout ? dayBurn(todayWorkout) : 0} />
            <div className="ring-legend">
              <div>{t('dashboard.intakeLabel')}<b className="num">{intake}</b></div>
              <div className="burn">{lang === 'en' ? '🔴 Burned' : '🔴 训练消耗'}<b className="num">{burned}</b></div>
              <div>{t('dashboard.netLabel')}<b className="num">{net}</b></div>
              <div>{t('dashboard.targetLabel')}<b className="num">{info.target}</b></div>
            </div>
          </section>

          <TodayProgress mealsEaten={todayRec?.mealsEaten.length ?? 0} workout={todayWorkout} doneCount={doneCount} burned={burned} />
        </div>
      </div>

      <section className="card mt-24" style={{ animationDelay: '300ms' }}>
        <div className="card-title">
          <h2>{lang === 'en' ? '🏁 Goal Progress' : '🏁 目标进度'}</h2>
          <Link to="/stats" className="btn btn-sm btn-ghost">{lang === 'en' ? 'View Stats →' : '查看统计 →'}</Link>
        </div>
        <GoalProgress start={profile.startWeightKg} current={info.weightKg} target={profile.targetWeightKg} progress={stats.progress} />
      </section>
    </>
  );
}
