import { useToast } from '../store/toast';

const ICON = { info: '💬', success: '✅', error: '⚠️' } as const;

export default function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          <span>{ICON[t.kind]}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
