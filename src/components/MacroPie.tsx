import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import EChart from './EChart';
import type { Macros } from '../types';
import { MACRO_COLORS, MACRO_KINDS, MACRO_LABELS, macroKcal } from '../domain/nutrition';

/** 三大营养素热量占比环形饼图，中心显示换算总热量 */
export default function MacroPie({ macros }: { macros: Macros }) {
  const option = useMemo<EChartsOption>(() => {
    const k = macroKcal(macros);
    const total = Math.round(k.protein + k.carbs + k.fat);
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 252, 248, 0.96)',
        borderColor: 'rgba(185, 115, 70, 0.24)',
        textStyle: { color: '#2c211b' },
        formatter: (p) => {
          const it = p as unknown as { name: string; value: number; percent: number; data: { g: number } };
          return `${it.name}<br/>${it.data.g} g · ${Math.round(it.value)} kcal · ${Math.round(it.percent)}%`;
        },
      },
      title: {
        text: `${total}`,
        subtext: 'kcal',
        left: 'center',
        top: '38%',
        textStyle: { color: '#2c211b', fontSize: 26, fontWeight: 600, fontFamily: 'Outfit, sans-serif' },
        subtextStyle: { color: '#6e584c', fontSize: 12 },
        itemGap: 2,
      },
      series: [
        {
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '50%'],
          padAngle: 2,
          itemStyle: { borderRadius: 8 },
          label: { show: false },
          emphasis: { scale: true, scaleSize: 6 },
          animationDuration: 700,
          data: MACRO_KINDS.map((kind) => ({
            name: MACRO_LABELS[kind],
            value: Math.round(k[kind]),
            g: macros[kind],
            itemStyle: { color: MACRO_COLORS[kind] },
          })),
        },
      ],
    };
  }, [macros]);

  return <EChart option={option} className="macro-pie" />;
}
