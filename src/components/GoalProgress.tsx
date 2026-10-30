import { useT } from '../i18n';

interface Props {
  start: number;
  current: number;
  target: number;
  progress: number; // 0–1
}

export default function GoalProgress({ start, current, target, progress }: Props) {
  const { t } = useT();
  const pct = Math.round(progress * 100);
  const left = `${Math.max(2, Math.min(98, pct))}%`;
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {t('goal.remaining')} <b className="num" style={{ color: 'var(--text)' }}>{Math.max(0, current - target).toFixed(1)}</b> kg
        </span>
        <span className="num grad-text" style={{ fontSize: 22, fontWeight: 800 }}>
          {pct}%
        </span>
      </div>
      <div className="progress">
        <div className="progress-fill" style={{ width: left }} />
        <div className="progress-dot" style={{ left }} />
      </div>
      <div className="progress-labels">
        <div>
          {t('goal.start')}
          <b className="num">{start}</b>
        </div>
        <div style={{ textAlign: 'center' }}>
          {t('goal.current')}
          <b className="num">{current}</b>
        </div>
        <div style={{ textAlign: 'right' }}>
          {t('goal.target')} 🎯
          <b className="num">{target}</b>
        </div>
      </div>
    </div>
  );
}
