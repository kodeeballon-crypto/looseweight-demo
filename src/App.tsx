import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import MealPlan from './pages/MealPlan';
import Settings from './pages/Settings';
import Toasts from './components/Toasts';
import { ConfirmHost } from './components/Modal';
import { BadgeHost } from './components/BadgePopup';
import { DISCLAIMER } from './constants';

const NAV = [
  { to: '/', ico: '🏠', label: '今日' },
  { to: '/stats', ico: '📈', label: '统计' },
  { to: '/plan', ico: '🥗', label: '饮食周表' },
  { to: '/settings', ico: '⚙️', label: '设置' },
];

/** 未填写档案时，任意页面重定向到设置页的档案表单 */
function Guard({ children }: { children: ReactNode }) {
  const profile = useStore((s) => s.profile);
  const loc = useLocation();
  if (!profile && loc.pathname !== '/settings') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🪶</div>
          <div>
            <div className="brand-name grad-text">轻盈</div>
            <div className="brand-sub">每天轻一点点</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} id={`nav-${n.to.replace('/', '') || 'home'}`}>
              <span className="nav-ico">{n.ico}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">数据仅保存在本机浏览器</div>
      </aside>

      <main className="main">
        <Guard>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/plan" element={<MealPlan />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Guard>
        <footer className="disclaimer">⚕️ {DISCLAIMER}</footer>
      </main>

      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <span>{n.ico}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <Toasts />
      <ConfirmHost />
      <BadgeHost />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
