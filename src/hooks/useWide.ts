import { useEffect, useState } from 'react';

const WIDE_QUERY = '(min-width: 1440px)';

/** 宽屏（≥1440px）时 AI 对话以右栏显示，否则为抽屉 */
export function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}
