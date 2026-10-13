import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';

export const BURN_C1 = '#ff4d6d';
export const BURN_C2 = '#ff8e5e';

/** 红色消耗环：已消耗 / 今日计划消耗 */
export default function BurnRing({ burned, plan, size = 96 }: { burned: number; plan: number; size?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const pct = plan > 0 ? Math.min(burned / plan, 1) : burned > 0 ? 1 : 0;
    return {
      series: [
        {
          type: 'pie',
          radius: ['76%', '96%'],
          silent: true,
          startAngle: 90,
          label: { show: false },
          itemStyle: { borderRadius: 20 },
          data: [
            {
              value: Math.max(pct, 0.0001),
              itemStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 1, colorStops: [{ offset: 0, color: BURN_C1 }, { offset: 1, color: BURN_C2 }] },
                shadowBlur: 14,
                shadowColor: BURN_C1 + '99',
              },
            },
            { value: Math.max(1 - pct, 0.0001), itemStyle: { color: 'rgba(255,255,255,0.07)', shadowBlur: 0 } },
          ],
          animationDuration: 1000,
          animationEasing: 'cubicOut',
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: { text: `${Math.round(pct * 100)}%`, fill: '#ffd1d9', fontSize: Math.round(size * 0.2), fontWeight: 700, fontFamily: 'Outfit, sans-serif' },
        },
      ],
    };
  }, [burned, plan, size]);

  return <EChart option={option} style={{ width: size, height: size, flex: 'none' }} />;
}
