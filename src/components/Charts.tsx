import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';
import type { DailyRecord, KcalStatus, WeekPlan, WorkoutLog } from '../types';
import { intakeOf, kcalStatus, movingAverage7, hasIntakeData } from '../domain/calc';
import { burnedOn, netIntake } from '../domain/workout';
import { BURN_C1, BURN_C2 } from './BurnRing';
import { useT } from '../i18n';

const AXIS = { lineStyle: { color: 'rgba(185, 115, 70, 0.22)' } };
const SPLIT = { lineStyle: { color: 'rgba(185, 115, 70, 0.1)' } };
const LABEL = { color: '#6e584c' };
const TOOLTIP = {
  trigger: 'axis' as const,
  backgroundColor: 'rgba(255, 252, 248, 0.96)',
  borderColor: 'rgba(185, 115, 70, 0.24)',
  textStyle: { color: '#2c211b' },
};

export function WeightChart({ records, target }: { records: DailyRecord[]; target: number }) {
  const { t } = useT();
  const option = useMemo<EChartsOption>(() => {
    const avg = movingAverage7(records);
    const ws = records.map((r) => r.weightKg);
    const min = Math.floor(Math.min(...ws, target) - 1);
    const max = Math.ceil(Math.max(...ws, target) + 1);
    return {
      grid: { left: 44, right: 24, top: 36, bottom: 30 },
      tooltip: { ...TOOLTIP, valueFormatter: (v) => `${Number(v).toFixed(1)} kg` },
      legend: { top: 0, right: 0, textStyle: LABEL, itemWidth: 14, data: [t('chart.dailyWeight'), t('chart.movingAvg')] },
      xAxis: { type: 'time', axisLine: AXIS, axisLabel: { ...LABEL, formatter: '{M}/{d}' }, splitLine: { show: false } },
      yAxis: { type: 'value', min, max, axisLabel: LABEL, splitLine: SPLIT },
      series: [
        {
          name: t('chart.dailyWeight'),
          type: 'line',
          data: records.map((r) => [r.date, r.weightKg]),
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 1.5, color: 'rgba(255, 120, 73, 0.55)' },
          itemStyle: { color: '#ff7849', borderColor: '#ffffff', borderWidth: 2 },
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: t('chart.targetKg', { n: target }), color: '#099268', position: 'insideEndTop' },
            lineStyle: { color: '#12b886', type: 'dashed', width: 1.5 },
            data: [{ yAxis: target }],
          },
        },
        {
          name: t('chart.movingAvg'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: avg.map((a) => [a.date, a.avg]),
          lineStyle: { width: 4, color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ff7849' }, { offset: 1, color: '#12b886' }] } },
          itemStyle: { color: '#ff7849' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255, 120, 73, 0.22)' }, { offset: 1, color: 'rgba(255, 120, 73, 0)' }] },
          },
        },
      ],
    };
  }, [records, target, t]);
  return <EChart option={option} className="chart-box" />;
}

const BAR: Record<KcalStatus, string> = { ok: '#12b886', slight: '#f59f00', over: '#f03e3e' };

/** 柱：摄入（按净摄入状态着色）+ 红色训练消耗；线：净摄入 */
export function KcalChart({ records, plan, target, log = {} }: { records: DailyRecord[]; plan: WeekPlan | null; target: number; log?: WorkoutLog }) {
  const { t } = useT();
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
      legend: { top: 0, right: 0, textStyle: LABEL, itemWidth: 14, data: hasBurn ? [t('chart.intake'), t('chart.burned'), t('chart.net')] : [t('chart.intake')] },
      xAxis: { type: 'category', data: rows.map((r) => r.date.slice(5)), axisLine: AXIS, axisLabel: LABEL },
      yAxis: { type: 'value', axisLabel: LABEL, splitLine: SPLIT },
      series: [
        {
          name: t('chart.intake'),
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: BAR.ok },
          data: rows.map((r) => ({ value: r.intake, itemStyle: { color: BAR[r.status], borderRadius: [8, 8, 2, 2] } })),
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: t('chart.target', { n: target }), color: '#6e584c', position: 'insideEndTop' },
            lineStyle: { color: '#ff7849', type: 'dashed', width: 1.5 },
            data: [{ yAxis: target }],
          },
        },
        ...(hasBurn
          ? [
            {
              name: t('chart.burned'),
              type: 'bar' as const,
              barMaxWidth: 22,
              data: rows.map((r) => r.burned),
              itemStyle: {
                color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: BURN_C1 }, { offset: 1, color: BURN_C2 }] },
                borderRadius: [8, 8, 2, 2],
                shadowBlur: 8,
                shadowColor: BURN_C1 + '44',
              },
            },
            {
              name: t('chart.net'),
              type: 'line' as const,
              data: rows.map((r) => r.net),
              symbol: 'circle',
              symbolSize: 7,
              lineStyle: { width: 2, color: '#2c211b' },
              itemStyle: { color: '#2c211b', borderColor: '#ffffff', borderWidth: 2 },
            },
          ]
          : []),
      ],
    };
  }, [records, plan, target, log, t]);
  return <EChart option={option} className="chart-box sm" />;
}
