import { useState } from 'react';
import dayjs from 'dayjs';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import type { DailyRecord } from '../types';
import {
  KCAL_STATUS_LABEL, bmiLevel, calcBmi, computeStats, energyInfo, hasIntakeData, intakeOf, kcalStatus, predictTargetDate, round1, sortRecords,
} from '../domain/calc';
import { burnedOn, netIntake } from '../domain/workout';
import MetricCard from '../components/MetricCard';
import { KcalChart, WeightChart } from '../components/Charts';
import CheckInForm from '../components/CheckInForm';
import { Modal, confirmDialog } from '../components/Modal';

type Range = 30 | 90 | 0;

export default function Stats() {
  const { profile, records, plan, workoutLog, upsertRecord, deleteRecord } = useStore();
  const [range, setRange] = useState<Range>(30);
  const [editing, setEditing] = useState<DailyRecord | null>(null);
  if (!profile) return null;

  const sorted = sortRecords(records);
  const info = energyInfo(profile, records);
  const stats = computeStats(profile, records, plan, info.target, workoutLog);
  const pred = predictTargetDate(profile, records);
  const from = range ? dayjs().subtract(range - 1, 'day').format('YYYY-MM-DD') : '';
  const shown = sorted.filter((r) => r.date >= from);
  const shownLog = Object.fromEntries(Object.entries(workoutLog).filter(([d]) => d >= from));
  const fmt = (n: number | null, unit = 'kg') => (n === null ? '--' : `${n > 0 ? '+' : ''}${n}${unit ? ' ' + unit : ''}`);

  const del = async (r: DailyRecord) => {
    if (await confirmDialog({ title: '删除这条记录？', message: `${r.date} · ${r.weightKg} kg`, okText: '删除', danger: true })) {
      deleteRecord(r.date);
      toast('已删除');
    }
  };

  if (records.length === 0)
    return (
      <>
        <div className="page-head"><div><h1>统计</h1><p>体重趋势、热量与历史记录</p></div></div>
        <div className="card empty">
          <div className="empty-ico">📊</div>
          <h2 style={{ fontSize: 20 }}>还没有数据</h2>
          <p>去首页完成第一次打卡，这里就会出现你的趋势图。</p>
        </div>
      </>
    );

  return (
    <>
      <div className="page-head">
        <div><h1>统计</h1><p>共 {records.length} 条记录 · 从 {profile.startDate} 开始</p></div>
      </div>

      <div className="grid grid-4">
        <MetricCard label="📅 近 7 天变化" accent="#22c7e8" value={<span className={stats.change7d !== null && stats.change7d < 0 ? 'text-ok' : ''}>{fmt(stats.change7d, '')}</span>} unit="kg" />
        <MetricCard label="📉 平均周减重" accent="#34e0a1" delay={60} value={stats.weeklyLoss ?? '--'} unit="kg/周" foot="建议每周 0.5–1 kg" />
        <MetricCard label="✅ 热量达标率" accent="#8b7cff" delay={120} value={stats.kcalOkRate === null ? '--' : Math.round(stats.kcalOkRate * 100)} unit="%" foot={`按净摄入统计 ${stats.kcalDays} 天`} />
        <MetricCard label="🎯 预计达成" accent="#ffc24b" delay={180}
          value={pred.kind === 'date' ? dayjs(pred.date).format('YYYY/M/D') : pred.kind === 'reached' ? '已达成 🎉' : '继续加油'}
          foot={pred.kind === 'date' ? `按近 4 周速度，约 ${pred.daysLeft} 天后` : pred.kind === 'keepGoing' ? '近 4 周暂无下降趋势' : '恭喜达到目标体重！'} />
      </div>

      <section className="card mt-24">
        <div className="card-title">
          <h2>⚖️ 体重趋势</h2>
          <div className="segmented">
            {([30, 90, 0] as Range[]).map((r) => (
              <button key={r} id={`range-${r || 'all'}`} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                {r ? `${r} 天` : '全部'}
              </button>
            ))}
          </div>
        </div>
        {shown.length ? <WeightChart records={shown} target={profile.targetWeightKg} /> : <div className="empty">该时间段内没有记录</div>}
      </section>

      <section className="card mt-24">
        <div className="card-title">
          <h2>🔥 每日热量</h2>
          <span className="card-sub">柱：摄入（绿=达标 黄=略超 红=超标）/ 🔴 训练消耗 · 线：净摄入</span>
        </div>
        {shown.some(hasIntakeData) || Object.keys(shownLog).length > 0 ? (
          <KcalChart records={shown} plan={plan} target={info.target} log={shownLog} />
        ) : (
          <div className="empty">打卡时勾选吃了哪几顿、在训练周表勾选完成的动作，这里就会显示热量柱状图</div>
        )}
      </section>

      <section className="card mt-24">
        <div className="card-title"><h2>📋 历史记录</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>日期</th><th>体重</th><th>较前一次</th><th>BMI</th><th>摄入</th><th>训练消耗</th><th>状态</th><th style={{ textAlign: 'right' }}>操作</th></tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((r) => {
                const idx = sorted.indexOf(r);
                const prev = idx > 0 ? sorted[idx - 1] : null;
                const d = prev ? round1(r.weightKg - prev.weightKg) : null;
                const bmi = calcBmi(r.weightKg, profile.heightCm);
                const k = intakeOf(r, plan).kcal;
                const burned = burnedOn(workoutLog, r.date);
                const net = netIntake(k, burned);
                const st = hasIntakeData(r) ? kcalStatus(net, info.target) : null;
                return (
                  <tr key={r.date}>
                    <td className="num">{r.date} <span className="faint">{['日', '一', '二', '三', '四', '五', '六'][dayjs(r.date).day()]}</span></td>
                    <td className="num"><b>{r.weightKg}</b> kg</td>
                    <td className={`num ${d === null || d === 0 ? 'faint' : d < 0 ? 'delta-down' : 'delta-up'}`}>
                      {d === null ? '—' : d === 0 ? '持平' : `${d < 0 ? '↓' : '↑'} ${Math.abs(d)}`}
                    </td>
                    <td className="num">{bmi.toFixed(1)} <span className="faint">{bmiLevel(bmi).label}</span></td>
                    <td className="num">
                      {st ? `${k} kcal` : <span className="faint">—</span>}
                      {st && burned > 0 && <span className="faint"> · 净 {net}</span>}
                    </td>
                    <td className="num">{burned > 0 ? <b className="burn-text">🔥 {burned} kcal</b> : <span className="faint">—</span>}</td>
                    <td>{st ? <span className={`tag tag-${st}`}>{KCAL_STATUS_LABEL[st]}</span> : <span className="faint">—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(r)}>✏️ 编辑</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => del(r)}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <h3>✏️ 编辑 {editing.date} 的记录</h3>
            <div className="mt-16">
              <CheckInForm key={editing.date} idPrefix="edit" date={editing.date} initial={editing} plan={plan} submitLabel="保存修改"
                onSubmit={(v) => {
                  upsertRecord({ ...v, encouragement: editing.encouragement });
                  setEditing(null);
                  toast('已保存修改', 'success');
                }} />
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
