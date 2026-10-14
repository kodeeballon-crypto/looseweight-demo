import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import MealPlan from './pages/MealPlan';
import Workout from './pages/Workout';
import Settings from './pages/Settings';
import Toasts from './components/Toasts';
import { ConfirmHost } from './components/Modal';
import { BadgeHost } from './components/BadgePopup';

import { useT } from './i18n';
import LangSwitch from './components/LangSwitch';

/** 未填写档案时，任意页面重定向到设置页的档案表单 */
function Guard({ children }: { children: ReactNode }) {
  const profile = useStore((s) => s.profile);
  const loc = useLocation();
  if (!profile && loc.pathname !== '/settings') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

function Shell() {
  const { t } = useT();

  const navItems = [
    { to: '/', ico: '🏠', label: t('nav.today'), id: 'nav-home' },
    { to: '/stats', ico: '📈', label: t('nav.stats'), id: 'nav-stats' },
    { to: '/plan', ico: '🥗', label: t('nav.plan'), id: 'nav-plan' },
    { to: '/workout', ico: '🏋️', label: t('nav.workout'), id: 'nav-workout' },
    { to: '/settings', ico: '⚙️', label: t('nav.settings'), id: 'nav-settings' },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🪶</div>
          <div className="brand-info">
            <div className="brand-name grad-text">{t('app.title')}</div>
            <div className="brand-sub">{t('app.slogan')}</div>
          </div>
          <LangSwitch className="brand-lang" />
        </div>
        <nav className="nav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} id={n.id}>
              <span className="nav-ico">{n.ico}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">{t('app.localOnly')}</div>
      </aside>

      <main className="main">
        <Guard>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/plan" element={<MealPlan />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Guard>
        <footer className="disclaimer">{t('app.disclaimer')}</footer>
      </main>

      <nav className="tabbar">
        {navItems.map((n) => (
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
