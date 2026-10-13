import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { Exercise, TrainingPrefs, Weekday } from '../types';
import { WEEKDAY_LABELS } from '../types';
import { chat, errorMessage, isAiConfigured } from '../ai/client';
import { replaceExerciseMessages, workoutPlanMessages } from '../ai/workoutPrompts';
import { parseExercise, parseWorkoutPlan } from '../ai/parseWorkout';
import { energyInfo, weekdayOf } from '../domain/calc';
import { DEFAULT_PREFS, LEVEL_LABELS, PLACE_LABELS, burnedOn, dayBurn, weekBurn } from '../domain/workout';
import { todayStr } from '../services/encourage';
import { useWide } from '../hooks/useWide';
import WorkoutTable from '../components/WorkoutTable';
import WorkoutDayModal from '../components/WorkoutDayModal';
import TrainingPrefsModal from '../components/TrainingPrefsModal';
import WorkoutChat, { type PendingWorkout } from '../components/WorkoutChat';
import BurnRing from '../components/BurnRing';
import { Modal, confirmDialog } from '../components/Modal';
import { DISCLAIMER } from '../constants';

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
      const raw = await chat(settings, workoutPlanMessages(profile, info.weightKg, prefs, workoutMemory), { timeoutMs: 60000, json: true });
      setWorkoutPlan(parseWorkoutPlan(raw));
      setPending(null);
      toast('新的一周训练计划已生成 💪', 'success');
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
      !(await confirmDialog({ title: '重新生成本周训练？', message: '当前训练周表（包括手动修改）将被替换，今天已完成的训练记录会保留。', okText: '重新生成' }))
    )
      return;
    await runGenerate(trainingPrefs);
  };

  const savePrefs = (p: TrainingPrefs) => {
    setTrainingPrefs(p);
    toast('训练条件已保存', 'success');
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
      const raw = await chat(settings, replaceExerciseMessages(profile, trainingPrefs ?? DEFAULT_PREFS, day, ex), { timeoutMs: 20000, json: true });
      const next = parseExercise(raw);
      updateExercise(w, ex.id, next);
      toast(`${WEEKDAY_LABELS[w - 1]}的「${ex.name}」已换成「${next.name}」`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (ex: Exercise) => {
    const wasDone = doneIds.has(ex.id);
    toggleExercise(date, ex);
    if (!wasDone) toast(`完成「${ex.name}」🔥 +${ex.kcal} kcal`, 'success');
  };

  const completeAll = () => {
    if (!todayDay) return;
    completeToday(date, todayDay.exercises);
    toast(`今日训练完成！共消耗 ${burnedOn(useStore.getState().workoutLog, date)} kcal，已同步到首页 🔥`, 'success');
  };

  const editingDay = editing && workoutPlan ? (workoutPlan.days.find((d) => d.weekday === editing) ?? null) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI 训练周表</h1>
          <p>跟着练就好 · 勾选今天完成的动作，消耗自动同步到首页</p>
        </div>
        <div className="row wrap">
          <button id="workout-prefs" className="btn" onClick={() => setPrefsOpen(true)}>
            ⚙️ 训练条件
          </button>
          {aiReady && (
            <button id="workout-generate" className="btn btn-burn btn-lg" disabled={generating} onClick={generate}>
              {generating ? <span className="spinner" /> : '✨'} {workoutPlan ? '重新生成本周训练' : '生成我的训练计划'}
            </button>
          )}
        </div>
      </div>

      {!aiReady && (
        <div className="card guide-card">
          <div className="big">🤖</div>
          <h2>先配置 AI，再生成专属训练计划</h2>
          <p>在设置页填入 DeepSeek / 通义千问 / Kimi / OpenAI 等任意 OpenAI 兼容接口的 Key，AI 教练会根据你的身体数据和训练条件安排一周训练。</p>
          <Link id="workout-go-settings" to="/settings" className="btn btn-violet btn-lg">
            去设置配置 AI →
          </Link>
        </div>
      )}

      {aiReady && !workoutPlan && !generating && (
        <div className="card guide-card">
          <div className="big">🏋️</div>
          <h2>还没有训练计划</h2>
          <p>
            {trainingPrefs
              ? `当前条件：${PLACE_LABELS[trainingPrefs.place]} · 每次 ${trainingPrefs.minutes} 分钟 · 每周 ${trainingPrefs.daysPerWeek} 天 · ${LEVEL_LABELS[trainingPrefs.level]}。`
              : '先告诉 AI 你的训练条件（场地、时长、每周天数），'}
            点击上方按钮，AI 教练会为你安排 7 天训练（约 20–60 秒）。
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
                  <span>今日已消耗</span>
                  <b className="num burn-text">{burned} kcal</b>
                  <small>今日计划 {todayPlan} kcal</small>
                </div>
              </div>
              <div className="plan-stat">
                <span>今日完成</span>
                <b className="num">
                  {doneCount} / {todayDay?.exercises.length ?? 0} 个动作
                </b>
              </div>
              <div className="plan-stat">
                <span>本周计划消耗</span>
                <b className="num burn-text">{weekBurn(workoutPlan)} kcal</b>
              </div>
              <div className="plan-stat">
                <span>生成时间</span>
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

            {workoutPlan.tips && workoutPlan.tips.length > 0 && (
              <section className="card mt-24">
                <div className="card-title">
                  <h2>💡 本周训练要点</h2>
                </div>
                <div className="tips">
                  {workoutPlan.tips.map((t, i) => (
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
          <button id="workout-chat-fab" className="chat-fab" style={{ background: 'var(--grad-burn)' }} onClick={() => setDrawerOpen(true)} aria-label="打开 AI 教练对话">
            🏋️<span>问教练</span>
            {pending && <i className="chat-fab-dot" />}
          </button>
          <div className={`chat-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
          <WorkoutChat variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} pending={pending} onPending={setPending} />
        </>
      )}

      <p className="field-hint mt-16" style={{ textAlign: 'center' }}>
        ⚕️ {DISCLAIMER} 训练中如出现疼痛或不适请立即停止。
      </p>

      <WorkoutDayModal
        open={!!editing}
        title={editing ? `${WEEKDAY_LABELS[editing - 1]} 训练` : ''}
        day={editingDay}
        onClose={() => setEditing(null)}
        onSave={(d) => {
          updateWorkoutDay(d.weekday, d);
          toast('已保存', 'success');
        }}
      />

      <TrainingPrefsModal
        open={prefsOpen}
        initial={trainingPrefs}
        saveLabel={genAfterPrefs ? '保存并生成' : '保存'}
        onClose={() => {
          setPrefsOpen(false);
          setGenAfterPrefs(false);
        }}
        onSave={savePrefs}
      />

      <Modal open={generating} onClose={() => {}} className="loading-card">
        <div className="loading-orb" style={{ background: 'var(--grad-burn)' }} />
        <h3>AI 教练正在为你安排训练…</h3>
        <p className="muted" style={{ margin: 0 }}>
          根据你的身体数据和训练条件安排 7 天训练，通常需要 20–60 秒
        </p>
      </Modal>
    </>
  );
}
