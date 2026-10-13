import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';
import type { KcalStatus } from '../types';
import { KCAL_STATUS_LABEL } from '../domain/calc';
import { BURN_C1, BURN_C2 } from './BurnRing';

const COLOR: Record<KcalStatus, [string, string]> = {
  ok: ['#34e0a1', '#22c7e8'],
  slight: ['#ffc24b', '#ff9f43'],
  over: ['#ff6b8b', '#ff8e5e'],
};

interface Props {
  /** 中心与外圈显示的数值（首页传净摄入） */
  intake: number;
  target: number;
  status: KcalStatus;
  /** 今日训练消耗；与 burnPlan 都为 0 时不显示内圈 */
  burned?: number;
  /** 今日计划消耗 */
  burnPlan?: number;
}

const BURN_FALLBACK = 300;

export default function KcalRing({ intake, target, status, burned = 0, burnPlan = 0 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    const [c1, c2] = COLOR[status];
    const pct = target > 0 ? Math.min(intake / target, 1) : 0;
    const showBurn = burned > 0 || burnPlan > 0;
    const burnPct = Math.min(burned / (burnPlan > 0 ? burnPlan : BURN_FALLBACK), 1);
    const ring = (radius: [string, string], p: number, a: string, b: string, startAngle = 90) => ({
      type: 'pie' as const,
      radius,
      silent: true,
      startAngle,
      label: { show: false },
      itemStyle: { borderRadius: 20 },
      data: [
        {
          value: Math.max(p, 0.0001),
          itemStyle: {
            color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 1, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] },
            shadowBlur: 18,
            shadowColor: a + '88',
          },
        },
        { value: Math.max(1 - p, 0.0001), itemStyle: { color: 'rgba(255,255,255,0.07)', shadowBlur: 0 } },
      ],
      animationDuration: 1200,
      animationEasing: 'cubicOut' as const,
    });
    return {
      series: [ring(['76%', '90%'], pct, c1, c2), ...(showBurn ? [ring(['62%', '70%'], burnPct, BURN_C1, BURN_C2)] : [])],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '36%',
          style: { text: String(intake), fill: '#eef2ff', fontSize: 36, fontWeight: 700, fontFamily: 'Outfit, sans-serif' },
        },
        {
          type: 'text',
          left: 'center',
          top: '55%',
          style: { text: `/ ${target} kcal`, fill: '#a8b1cf', fontSize: 13, fontFamily: 'Outfit, sans-serif' },
        },
        {
          type: 'text',
          left: 'center',
          top: '65%',
          style: { text: showBurn ? `🔥 -${burned}` : KCAL_STATUS_LABEL[status], fill: showBurn ? BURN_C1 : c1, fontSize: 13, fontWeight: 700 },
        },
      ],
    };
  }, [intake, target, status, burned, burnPlan]);

  return <EChart option={option} style={{ width: '100%', height: 230 }} />;
}
