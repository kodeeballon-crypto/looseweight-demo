import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  accent?: string;
  delay?: number;
  id?: string;
}

export default function MetricCard({ label, value, unit, foot, accent, delay = 0, id }: Props) {
  return (
    <div
      id={id}
      className="card metric"
      style={{ ['--accent' as string]: accent, animationDelay: `${delay}ms` } as React.CSSProperties}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value num">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="metric-foot">{foot}</div>}
    </div>
  );
}
