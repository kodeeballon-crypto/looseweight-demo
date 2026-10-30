import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { useT } from '../i18n';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className ?? ''}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

// ---------- 全局二次确认 ----------

interface ConfirmReq {
  title: string;
  message?: string;
  okText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ req: ConfirmReq | null; set: (r: ConfirmReq | null) => void }>((set) => ({
  req: null,
  set: (req) => set({ req }),
}));

/** 用法：if (await confirmDialog({ title: '确定删除？' })) {...} */
export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const { t } = useT();
  const close = (ok: boolean) => {
    req?.resolve(ok);
    set(null);
  };
  return (
    <Modal open={!!req} onClose={() => close(false)}>
      {req && (
        <>
          <h3>{req.title}</h3>
          {req.message && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{req.message}</p>}
          <div className="modal-actions">
            <button id="confirm-cancel" className="btn btn-ghost" onClick={() => close(false)}>
              {t('dialog.cancel')}
            </button>
            <button
              id="confirm-ok"
              className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              autoFocus
            >
              {req.okText ?? t('dialog.ok')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
