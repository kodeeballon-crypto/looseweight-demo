import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';
import type { KcalStatus } from '../types';
import { KCAL_STATUS_LABEL } from '../domain/calc';

const COLOR: Record<KcalStatus, [string, string]> = {
  ok: ['#34e0a1', '#22c7e8'],
  slight: ['#ffc24b', '#ff9f43'],
  over: ['#ff6b8b', '#ff8e5e'],
};

export default function KcalRing({ intake, target, status }: { intake: number; target: number; status: KcalStatus }) {
  const option = useMemo<EChartsOption>(() => {
    const [c1, c2] = COLOR[status];
    const pct = target > 0 ? Math.min(intake / target, 1) : 0;
    return {
      series: [
        {
          type: 'pie',
          radius: ['72%', '88%'],
          silent: true,
          startAngle: 90,
          label: { show: false },
          itemStyle: { borderRadius: 20 },
          data: [
            {
              value: Math.max(pct, 0.0001),
              itemStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 1, colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] },
                shadowBlur: 18,
                shadowColor: c1 + '88',
              },
            },
            { value: Math.max(1 - pct, 0.0001), itemStyle: { color: 'rgba(255,255,255,0.07)', shadowBlur: 0 } },
          ],
          animationDuration: 1200,
          animationEasing: 'cubicOut',
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '36%',
          style: { text: String(intake), fill: '#eef2ff', fontSize: 38, fontWeight: 700, fontFamily: 'Outfit, sans-serif' },
        },
        {
          type: 'text',
          left: 'center',
          top: '56%',
          style: { text: `/ ${target} kcal`, fill: '#a8b1cf', fontSize: 14, fontFamily: 'Outfit, sans-serif' },
        },
        {
          type: 'text',
          left: 'center',
          top: '67%',
          style: { text: KCAL_STATUS_LABEL[status], fill: c1, fontSize: 14, fontWeight: 700 },
        },
      ],
    };
  }, [intake, target, status]);

  return <EChart option={option} style={{ width: '100%', height: 230 }} />;
}
