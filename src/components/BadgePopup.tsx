import { useMemo } from 'react';
import { create } from 'zustand';
import type { Badge } from '../domain/badges';
import { useStore } from '../store/useStore';
import { Modal } from './Modal';

const useBadgeQueue = create<{ badges: Badge[]; set: (b: Badge[]) => void }>((set) => ({
  badges: [],
  set: (badges) => set({ badges }),
}));

export function showBadges(badges: Badge[]) {
  if (badges.length) useBadgeQueue.getState().set(badges);
}

const COLORS = ['#34e0a1', '#22c7e8', '#8b7cff', '#ffc24b', '#ff6b8b', '#5aa9ff'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function BadgeHost() {
  const { badges, set } = useBadgeQueue();
  const markSeen = useStore((s) => s.markBadgesSeen);
  const close = () => {
    markSeen(badges.map((b) => b.id));
    set([]);
  };
  const main = badges[badges.length - 1];

  return (
    <>
      {badges.length > 0 && <Confetti />}
      <Modal open={badges.length > 0} onClose={close} className="badge-pop">
        {main && (
          <>
            <div className="faint" style={{ fontSize: 13, letterSpacing: 2 }}>
              🎊 解锁新徽章
            </div>
            <div className="badge-emoji" style={{ margin: '18px 0 10px' }}>
              {main.emoji}
            </div>
            <h3 style={{ fontSize: 24 }} className="grad-text">
              {main.title}
            </h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {main.desc}
            </p>
            {badges.length > 1 && (
              <div className="badge-list">
                {badges.slice(0, -1).map((b) => (
                  <span key={b.id} className="tag">
                    {b.emoji} {b.title}
                  </span>
                ))}
              </div>
            )}
            <button id="badge-close" className="btn btn-primary btn-lg mt-24" onClick={close}>
              太棒了，继续加油！
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
