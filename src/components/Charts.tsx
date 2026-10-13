import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';
import type { DailyRecord, KcalStatus, WeekPlan, WorkoutLog } from '../types';
import { intakeOf, kcalStatus, movingAverage7, hasIntakeData } from '../domain/calc';
import { burnedOn, netIntake } from '../domain/workout';
import { BURN_C1, BURN_C2 } from './BurnRing';

const AXIS = { lineStyle: { color: 'rgba(255,255,255,0.12)' } };
const SPLIT = { lineStyle: { color: 'rgba(255,255,255,0.06)' } };
const LABEL = { color: '#8b93b3' };
const TOOLTIP = {
  trigger: 'axis' as const,
  backgroundColor: 'rgba(15,22,48,0.95)',
  borderColor: 'rgba(255,255,255,0.15)',
  textStyle: { color: '#eef2ff' },
};

export function WeightChart({ records, target }: { records: DailyRecord[]; target: number }) {
  const option = useMemo<EChartsOption>(() => {
    const avg = movingAverage7(records);
    const ws = records.map((r) => r.weightKg);
    const min = Math.floor(Math.min(...ws, target) - 1);
    const max = Math.ceil(Math.max(...ws, target) + 1);
    return {
      grid: { left: 44, right: 24, top: 36, bottom: 30 },
      tooltip: { ...TOOLTIP, valueFormatter: (v) => `${Number(v).toFixed(1)} kg` },
      legend: { top: 0, right: 0, textStyle: LABEL, itemWidth: 14, data: ['每日体重', '7 日均线'] },
      xAxis: { type: 'time', axisLine: AXIS, axisLabel: { ...LABEL, formatter: '{M}/{d}' }, splitLine: { show: false } },
      yAxis: { type: 'value', min, max, axisLabel: LABEL, splitLine: SPLIT },
      series: [
        {
          name: '每日体重',
          type: 'line',
          data: records.map((r) => [r.date, r.weightKg]),
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 1.5, color: 'rgba(34,199,232,0.55)' },
          itemStyle: { color: '#22c7e8', borderColor: '#0a0f1e', borderWidth: 2 },
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: `目标 ${target} kg`, color: '#ffc24b', position: 'insideEndTop' },
            lineStyle: { color: '#ffc24b', type: 'dashed', width: 1.5 },
            data: [{ yAxis: target }],
          },
        },
        {
          name: '7 日均线',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: avg.map((a) => [a.date, a.avg]),
          lineStyle: { width: 4, color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#34e0a1' }, { offset: 1, color: '#8b7cff' }] } },
          itemStyle: { color: '#34e0a1' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(52,224,161,0.25)' }, { offset: 1, color: 'rgba(52,224,161,0)' }] },
          },
        },
      ],
    };
  }, [records, target]);
  return <EChart option={option} className="chart-box" />;
}

const BAR: Record<KcalStatus, string> = { ok: '#34e0a1', slight: '#ffc24b', over: '#ff6b8b' };

/** 柱：摄入（按净摄入状态着色）+ 红色训练消耗；线：净摄入 */
export function KcalChart({ records, plan, target, log = {} }: { records: DailyRecord[]; plan: WeekPlan | null; target: number; log?: WorkoutLog }) {
  const option = useMemo<EChartsOption>(() => {
    const byDate = new Map(records.filter(hasIntakeData).map((r) => [r.date, r]));
    const dates = [...new Set([...byDate.keys(), ...Object.keys(log).filter((d) => burnedOn(log, d) > 0)])].sort();
    const rows = dates.map((date) => {
      const r = byDate.get(date);
      const intake = r ? intakeOf(r, plan).kcal : 0;
      const burned = burnedOn(log, date);
      const net = netIntake(intake, burned);
      return { date, intake, burned, net, status: kcalStatus(net, target) };
    });
    const hasBurn = rows.some((r) => r.burned > 0);
    return {
      grid: { left: 48, right: 24, top: 36, bottom: 30 },
      tooltip: { ...TOOLTIP, valueFormatter: (v) => `${v} kcal` },
      legend: { top: 0, right: 0, textStyle: LABEL, itemWidth: 14, data: hasBurn ? ['摄入', '训练消耗', '净摄入'] : ['摄入'] },
      xAxis: { type: 'category', data: rows.map((r) => r.date.slice(5)), axisLine: AXIS, axisLabel: LABEL },
      yAxis: { type: 'value', axisLabel: LABEL, splitLine: SPLIT },
      series: [
        {
          name: '摄入',
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: BAR.ok },
          data: rows.map((r) => ({ value: r.intake, itemStyle: { color: BAR[r.status], borderRadius: [8, 8, 2, 2] } })),
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: `目标 ${target}`, color: '#a8b1cf', position: 'insideEndTop' },
            lineStyle: { color: '#8b7cff', type: 'dashed', width: 1.5 },
            data: [{ yAxis: target }],
          },
        },
        ...(hasBurn
          ? [
              {
                name: '训练消耗',
                type: 'bar' as const,
                barMaxWidth: 22,
                data: rows.map((r) => r.burned),
                itemStyle: {
                  color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: BURN_C1 }, { offset: 1, color: BURN_C2 }] },
                  borderRadius: [8, 8, 2, 2],
                  shadowBlur: 10,
                  shadowColor: BURN_C1 + '66',
                },
              },
              {
                name: '净摄入',
                type: 'line' as const,
                data: rows.map((r) => r.net),
                symbol: 'circle',
                symbolSize: 7,
                lineStyle: { width: 1.5, color: '#eef2ff' },
                itemStyle: { color: '#eef2ff', borderColor: '#0a0f1e', borderWidth: 2 },
              },
            ]
          : []),
      ],
    };
  }, [records, plan, target, log]);
  return <EChart option={option} className="chart-box sm" />;
}
