import { useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { bmiLevel, computeStats, energyInfo, intakeOf, kcalStatus } from '../domain/calc';
import { calcStreak, newBadges, unlockedBadges } from '../domain/badges';
import { generateEncouragement, todayStr } from '../services/encourage';
import { isAiConfigured } from '../ai/client';
import MetricCard from '../components/MetricCard';
import CheckInForm, { type CheckInValues } from '../components/CheckInForm';
import KcalRing from '../components/KcalRing';
import GoalProgress from '../components/GoalProgress';
import { showBadges } from '../components/BadgePopup';

const BMI_COLOR = { under: '#5aa9ff', normal: '#34e0a1', over: '#ffc24b', obese: '#ff6b8b' } as const;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，早点休息 🌙';
  if (h < 11) return '早上好 ☀️';
  if (h < 14) return '中午好 🍱';
  if (h < 18) return '下午好 🌤️';
  return '晚上好 🌆';
}

export default function Dashboard() {
  const { profile, records, plan, settings, seenBadges, upsertRecord, setEncouragement } = useStore();
  const [genBusy, setGenBusy] = useState(false);
  if (!profile) return null;

  const today = todayStr();
  const todayRec = records.find((r) => r.date === today);
  const info = energyInfo(profile, records);
  const stats = computeStats(profile, records, plan, info.target);
  const streak = calcStreak(records, today);
  const level = bmiLevel(info.bmi);
  const intake = intakeOf(todayRec ?? { date: today, mealsEaten: [] }, plan).kcal;
  const status = kcalStatus(intake, info.target);

  const runEncourage = async (newMilestone: boolean) => {
    const s = useStore.getState();
    setGenBusy(true);
    const res = await generateEncouragement({ ...s, profile, date: today, newMilestone });
    setGenBusy(false);
    if (res.text) setEncouragement(today, res.text);
    if (res.error) toast(`AI 鼓励生成失败，已使用内置鼓励：${res.error}`, 'error');
  };

  const onSubmit = async (v: CheckInValues) => {
    const first = !todayRec;
    upsertRecord({ ...v, encouragement: todayRec?.encouragement });
    toast(first ? '打卡成功！' : '已更新今日打卡', 'success');

    const after = useStore.getState().records;
    const fresh = newBadges(unlockedBadges(profile, after, today), seenBadges);
    showBadges(fresh);
    if (!todayRec?.encouragement) await runEncourage(fresh.length > 0);
  };

  return (
    <>
      <div className="hero">
        <div>
          <h1>{greeting()}</h1>
          <p>
            {dayjs().format('M 月 D 日')} · 星期{WEEK[dayjs().day()]} ·{' '}
            {todayRec ? '今天已经打过卡啦 ✅' : '今天还没打卡哦'}
          </p>
        </div>
        <div className="streak-chip" id="streak-chip">
          <span className="flame">🔥</span> 连续打卡 <span className="num">{streak}</span> 天
        </div>
      </div>

      <div className="grid grid-4">
        <MetricCard id="m-weight" label="⚖️ 当前体重" value={info.weightKg} unit="kg" accent="#22c7e8"
          foot={stats.change7d !== null ? `近 7 天 ${stats.change7d > 0 ? '+' : ''}${stats.change7d} kg` : '开始记录后显示变化'} />
        <MetricCard id="m-loss" label="📉 累计减重" value={stats.totalLoss > 0 ? stats.totalLoss : 0} unit="kg" accent="#34e0a1" delay={60}
          foot={`初始 ${profile.startWeightKg} kg`} />
        <MetricCard id="m-bmi" label="🧮 BMI" accent={BMI_COLOR[level.key]} delay={120}
          value={<span style={{ color: BMI_COLOR[level.key] }}>{info.bmi.toFixed(1)}</span>}
          foot={<span className="tag" style={{ color: BMI_COLOR[level.key] }}>{level.label}</span>} />
        <MetricCard id="m-streak" label="🔥 连续打卡" value={streak} unit="天" accent="#ffc24b" delay={180}
          foot={`每日热量目标 ${info.target} kcal`} />
      </div>

      <div className="grid dash-main mt-24">
        <section className="card" style={{ animationDelay: '120ms' }}>
          <div className="card-title">
            <h2>✍️ 今日打卡</h2>
            <span className="card-sub">{today}</span>
          </div>
          {todayRec && <div className="checked-banner">✅ 今日已打卡，可以随时修改后重新保存</div>}
          <CheckInForm
            key={todayRec ? `edit-${today}` : `new-${today}`}
            date={today}
            initial={todayRec}
            plan={plan}
            busy={genBusy}
            submitLabel={todayRec ? '更新打卡' : '打卡 💪'}
            onSubmit={onSubmit}
          />
        </section>

        <div className="stack">
          <section className="card encourage" style={{ animationDelay: '180ms' }}>
            <div className="card-title">
              <h2>💌 给你的话</h2>
              {todayRec && (
                <button id="encourage-refresh" className="btn btn-sm btn-ghost" disabled={genBusy} onClick={() => runEncourage(false)}>
                  {genBusy ? <span className="spinner" /> : '🔄'} 换一句
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
                完成今天的打卡，我会根据你的数据送上一段专属鼓励 ✨
                {!isAiConfigured(settings) && (
                  <span className="field-hint" style={{ display: 'block', marginTop: 8 }}>
                    （未配置 AI 时使用内置鼓励语，<Link to="/settings">去配置</Link>）
                  </span>
                )}
              </p>
            )}
          </section>

          <section className="card" style={{ animationDelay: '240ms' }}>
            <div className="card-title">
              <h2>🔥 今日热量</h2>
              <span className={`tag tag-${status}`}>{intake === 0 ? '未记录' : status === 'ok' ? '达标' : status === 'slight' ? '略超' : '超标'}</span>
            </div>
            <KcalRing intake={intake} target={info.target} status={status} />
            <div className="ring-legend">
              <div>已摄入<b className="num">{intake}</b></div>
              <div>剩余<b className="num">{Math.max(0, info.target - intake)}</b></div>
              <div>目标<b className="num">{info.target}</b></div>
            </div>
          </section>
        </div>
      </div>

      <section className="card mt-24" style={{ animationDelay: '300ms' }}>
        <div className="card-title">
          <h2>🏁 目标进度</h2>
          <Link to="/stats" className="btn btn-sm btn-ghost">查看统计 →</Link>
        </div>
        <GoalProgress start={profile.startWeightKg} current={info.weightKg} target={profile.targetWeightKg} progress={stats.progress} />
      </section>
    </>
  );
}
