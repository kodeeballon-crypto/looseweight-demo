import { useMemo, useState } from 'react';
import { AI_TIMEOUT } from '../config/ai';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { Exercise, TrainingPrefs, Weekday } from '../types';
import { getWeekdayLabel, getWorkoutTips } from '../types';
import { chat, errorMessage, isAiConfigured } from '../ai/client';
import { replaceExerciseMessages, workoutPlanMessages } from '../ai/workoutPrompts';
import { parseExercise, parseWorkoutPlan } from '../ai/parseWorkout';
import { energyInfo, weekdayOf } from '../domain/calc';
import { DEFAULT_PREFS, getLevelLabel, getPlaceLabel, burnedOn, dayBurn, weekBurn } from '../domain/workout';
import { todayStr } from '../services/encourage';
import { useWide } from '../hooks/useWide';
import WorkoutTable from '../components/WorkoutTable';
import WorkoutDayModal from '../components/WorkoutDayModal';
import TrainingPrefsModal from '../components/TrainingPrefsModal';
import WorkoutChat, { type PendingWorkout } from '../components/WorkoutChat';
import BurnRing from '../components/BurnRing';
import { Modal, confirmDialog } from '../components/Modal';
import { useT } from '../i18n';

export default function Workout() {
  const {
    profile,
    records,
    settings,
    trainingPrefs,
    workoutPlan,
    workoutLog,
    workoutMemory,
    setTrainingPrefs,
    setWorkoutPlan,
    updateWorkoutDay,
    updateExercise,
    toggleExercise,
    completeToday,
  } = useStore();
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Weekday | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [genAfterPrefs, setGenAfterPrefs] = useState(false);
  const [pending, setPending] = useState<PendingWorkout | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = useWide();
  const { t, lang } = useT();
  const preview = useMemo(() => (pending ? new Map(pending.changes.map((c) => [c.weekday, c.next])) : undefined), [pending]);
  if (!profile) return null;

  const aiReady = isAiConfigured(settings);
  const info = energyInfo(profile, records);
  const date = todayStr();
  const today = weekdayOf(date);

  const todayDay = workoutPlan?.days.find((d) => d.weekday === today);
  const doneList = workoutLog[date] ?? [];
  const doneIds = new Set(doneList.map((e) => e.id));
  const burned = burnedOn(workoutLog, date);
  const todayPlan = todayDay ? dayBurn(todayDay) : 0;
  const planIds = new Set(todayDay?.exercises.map((e) => e.id));
  const orphans = doneList.filter((e) => !planIds.has(e.id));
  const orphan = { count: orphans.length, kcal: orphans.reduce((s, e) => s + e.kcal, 0) };
  const doneCount = todayDay ? todayDay.exercises.filter((e) => doneIds.has(e.id)).length : 0;

  const runGenerate = async (prefs: TrainingPrefs) => {
    setGenerating(true);
    try {
      const raw = await chat(settings, workoutPlanMessages(profile, info.weightKg, prefs, workoutMemory), { timeoutMs: AI_TIMEOUT.weekPlan, json: true });
      setWorkoutPlan(parseWorkoutPlan(raw));
      setPending(null);
      toast(lang === 'en' ? 'New weekly workout plan generated 💪' : '新的一周训练计划已生成 💪', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error'); // 保留原计划
    } finally {
      setGenerating(false);
    }
  };

  const generate = async () => {
    if (!trainingPrefs) {
      setGenAfterPrefs(true);
      setPrefsOpen(true);
      return;
    }
    if (
      workoutPlan &&
      !(await confirmDialog({
        title: lang === 'en' ? 'Regenerate Weekly Workout?' : '重新生成本周训练？',
        message: lang === 'en'
          ? 'Your current weekly workout plan (including manual edits) will be replaced. Completed workouts for today will be kept.'
          : '当前训练周表（包括手动修改）将被替换，今天已完成的训练记录会保留。',
        okText: lang === 'en' ? 'Regenerate' : '重新生成',
      }))
    )
      return;
    await runGenerate(trainingPrefs);
  };

  const savePrefs = (p: TrainingPrefs) => {
    setTrainingPrefs(p);
    toast(lang === 'en' ? 'Workout preferences saved' : '训练条件已保存', 'success');
    if (genAfterPrefs) {
      setGenAfterPrefs(false);
      void runGenerate(p);
    }
  };

  const swap = async (w: Weekday, ex: Exercise) => {
    const day = workoutPlan?.days.find((d) => d.weekday === w);
    if (!day) return;
    setBusyId(ex.id);
    try {
      const raw = await chat(settings, replaceExerciseMessages(profile, trainingPrefs ?? DEFAULT_PREFS, day, ex), { timeoutMs: AI_TIMEOUT.swap, json: true });
      const next = parseExercise(raw);
      updateExercise(w, ex.id, next);
      toast(
        lang === 'en'
          ? `Replaced "${ex.name}" with "${next.name}" on ${getWeekdayLabel(w, lang)}`
          : `${getWeekdayLabel(w, lang)}的「${ex.name}」已换成「${next.name}」`,
        'success'
      );
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (ex: Exercise) => {
    const wasDone = doneIds.has(ex.id);
    toggleExercise(date, ex);
    if (!wasDone) {
      toast(
        lang === 'en' ? `Completed "${ex.name}" 🔥 +${ex.kcal} kcal` : `完成「${ex.name}」🔥 +${ex.kcal} kcal`,
        'success'
      );
    }
  };

  const completeAll = () => {
    if (!todayDay) return;
    completeToday(date, todayDay.exercises);
    toast(
      lang === 'en'
        ? `Today's workout completed! Burned ${burnedOn(useStore.getState().workoutLog, date)} kcal, synced to dashboard 🔥`
        : `今日训练完成！共消耗 ${burnedOn(useStore.getState().workoutLog, date)} kcal，已同步到首页 🔥`,
      'success'
    );
  };

  const editingDay = editing && workoutPlan ? (workoutPlan.days.find((d) => d.weekday === editing) ?? null) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{lang === 'en' ? 'AI Workout Plan' : 'AI 训练周表'}</h1>
          <p>{lang === 'en' ? 'Follow along · Check off exercises completed today to sync burn calories to dashboard' : '跟着练就好 · 勾选今天完成的动作，消耗自动同步到首页'}</p>
        </div>
        <div className="row wrap">
          <button id="workout-prefs" className="btn" onClick={() => setPrefsOpen(true)}>
            ⚙️ {lang === 'en' ? 'Workout Preferences' : '训练条件'}
          </button>
          {aiReady && (
            <button id="workout-generate" className="btn btn-burn btn-lg" disabled={generating} onClick={generate}>
              {generating ? <span className="spinner" /> : '✨'}{' '}
              {workoutPlan
                ? (lang === 'en' ? 'Regenerate Workout' : '重新生成本周训练')
                : (lang === 'en' ? 'Generate Workout Plan' : '生成我的训练计划')}
            </button>
          )}
        </div>
      </div>

      {!aiReady && (
        <div className="card guide-card">
          <div className="big">🤖</div>
          <h2>{lang === 'en' ? 'Configure AI First to Generate Workout Plan' : '先配置 AI，再生成专属训练计划'}</h2>
          <p>
            {lang === 'en'
              ? 'Enter an API key for any OpenAI-compatible provider (DeepSeek, Qwen, Kimi, OpenAI, etc.) in Settings. Your AI coach will arrange a 7-day workout tailored to your body stats and preferences.'
              : '在设置页填入 DeepSeek / 通义千问 / Kimi / OpenAI 等任意 OpenAI 兼容接口的 Key，AI 教练会根据你的身体数据和训练条件安排一周训练。'}
          </p>
          <Link id="workout-go-settings" to="/settings" className="btn btn-violet btn-lg">
            {lang === 'en' ? 'Go to Settings →' : '去设置配置 AI →'}
          </Link>
        </div>
      )}

      {aiReady && !workoutPlan && !generating && (
        <div className="card guide-card">
          <div className="big">🏋️</div>
          <h2>{lang === 'en' ? 'No Workout Plan Yet' : '还没有训练计划'}</h2>
          <p>
            {trainingPrefs
              ? (lang === 'en'
                ? `Current preferences: ${getPlaceLabel(trainingPrefs.place, lang)} · ${trainingPrefs.minutes} min/session · ${trainingPrefs.daysPerWeek} days/wk · ${getLevelLabel(trainingPrefs.level, lang)}. Click above and AI Coach will arrange 7 days of workouts (~20-60s).`
                : `当前条件：${getPlaceLabel(trainingPrefs.place, lang)} · 每次 ${trainingPrefs.minutes} 分钟 · 每周 ${trainingPrefs.daysPerWeek} 天 · ${getLevelLabel(trainingPrefs.level, lang)}。点击上方按钮，AI 教练会为你安排 7 天训练（约 20–60 秒）。`)
              : (lang === 'en'
                ? 'Tell AI your training conditions first (place, duration, days per week). Click the button above and AI Coach will arrange 7 days of workouts (~20-60s).'
                : '先告诉 AI 你的训练条件（场地、时长、每周天数），点击上方按钮，AI 教练会为你安排 7 天训练（约 20–60 秒）。')}
          </p>
        </div>
      )}

      {workoutPlan && (
        <div className={`plan-layout ${aiReady && wide ? 'with-chat' : ''}`}>
          <div className="plan-main">
            <div className="plan-head" style={{ marginBottom: 18 }}>
              <div className="wo-burn-card" id="workout-burn-today">
                <BurnRing burned={burned} plan={todayPlan} size={84} />
                <div>
                  <span>{lang === 'en' ? 'Burned Today' : '今日已消耗'}</span>
                  <b className="num burn-text">{burned} kcal</b>
                  <small>{lang === 'en' ? `Planned ${todayPlan} kcal today` : `今日计划 ${todayPlan} kcal`}</small>
                </div>
              </div>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Completed Today' : '今日完成'}</span>
                <b className="num">
                  {lang === 'en'
                    ? `${doneCount} / ${todayDay?.exercises.length ?? 0} exercises`
                    : `${doneCount} / ${todayDay?.exercises.length ?? 0} 个动作`}
                </b>
              </div>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Planned Weekly Burn' : '本周计划消耗'}</span>
                <b className="num burn-text">{weekBurn(workoutPlan)} kcal</b>
              </div>
              <div className="plan-stat">
                <span>{lang === 'en' ? 'Generated At' : '生成时间'}</span>
                <b className="num" style={{ fontSize: 15 }}>
                  {dayjs(workoutPlan.createdAt).format('M/D HH:mm')}
                </b>
              </div>
            </div>

            <WorkoutTable
              plan={workoutPlan}
              today={today}
              doneIds={doneIds}
              burnedToday={burned}
              orphan={orphan}
              aiReady={aiReady}
              busyId={busyId}
              preview={preview}
              onToggle={toggle}
              onCompleteAll={completeAll}
              onEditDay={setEditing}
              onSwap={swap}
            />

            {getWorkoutTips(workoutPlan, lang).length > 0 && (
              <section className="card mt-24">
                <div className="card-title">
                  <h2>{lang === 'en' ? '💡 Weekly Workout Tips' : '💡 本周训练要点'}</h2>
                </div>
                <div className="tips">
                  {getWorkoutTips(workoutPlan, lang).map((t, i) => (
                    <div className="tip" key={i}>
                      <span className="tip-no" style={{ background: 'var(--grad-burn)', color: '#fff' }}>
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {aiReady && wide && <WorkoutChat variant="panel" pending={pending} onPending={setPending} />}
        </div>
      )}

      {workoutPlan && aiReady && !wide && (
        <>
          <button id="workout-chat-fab" className="chat-fab" style={{ background: 'var(--grad-burn)' }} onClick={() => setDrawerOpen(true)} aria-label={lang === 'en' ? 'Open AI coach chat' : '打开 AI 教练对话'}>
            🏋️<span>{lang === 'en' ? 'Ask Coach' : '问教练'}</span>
            {pending && <i className="chat-fab-dot" />}
          </button>
          <div className={`chat-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
          <WorkoutChat variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} pending={pending} onPending={setPending} />
        </>
      )}

      <p className="field-hint mt-16" style={{ textAlign: 'center' }}>
        ⚕️ {t('doc.aiDisclaimer')} {lang === 'en' ? 'Stop immediately if you experience pain or discomfort.' : '训练中如出现疼痛或不适请立即停止。'}
      </p>

      <WorkoutDayModal
        open={!!editing}
        title={editing ? `${getWeekdayLabel(editing, lang)} ${lang === 'en' ? 'Workout' : '训练'}` : ''}
        day={editingDay}
        onClose={() => setEditing(null)}
        onSave={(d) => {
          updateWorkoutDay(d.weekday, d);
          toast(lang === 'en' ? 'Saved' : '已保存', 'success');
        }}
      />

      <TrainingPrefsModal
        open={prefsOpen}
        initial={trainingPrefs}
        saveLabel={genAfterPrefs ? (lang === 'en' ? 'Save & Generate' : '保存并生成') : (lang === 'en' ? 'Save' : '保存')}
        onClose={() => {
          setPrefsOpen(false);
          setGenAfterPrefs(false);
        }}
        onSave={savePrefs}
      />

      <Modal open={generating} onClose={() => {}} className="loading-card">
        <div className="loading-orb" style={{ background: 'var(--grad-burn)' }} />
        <h3>{lang === 'en' ? 'AI Coach is crafting your workout…' : 'AI 教练正在为你安排训练…'}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {lang === 'en'
            ? 'Arranging 7 days of training based on your body stats and preferences, usually takes 20–60s'
            : '根据你的身体数据和训练条件安排 7 天训练，通常需要 20–60 秒'}
        </p>
      </Modal>
    </>
  );
}
