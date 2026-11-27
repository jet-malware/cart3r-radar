import { useEffect, useState } from 'react';
import { api } from './api.js';
import { UserContext, can } from './auth.jsx';
import { useI18n, LangSwitch } from './i18n/index.jsx';
import Overview from './pages/Overview.jsx';
import Alerts from './pages/Alerts.jsx';
import Analytics from './pages/Analytics.jsx';
import Cases from './pages/Cases.jsx';
import Rules from './pages/Rules.jsx';
import Simulator from './pages/Simulator.jsx';
import Account from './pages/Account.jsx';
import Login from './pages/Login.jsx';

// [id, translation key, component, minimum role]
const TABS = [
  ['overview', 'nav.overview', Overview, 'viewer'],
  ['alerts', 'nav.alerts', Alerts, 'viewer'],
  ['analytics', 'nav.analytics', Analytics, 'viewer'],
  ['cases', 'nav.cases', Cases, 'viewer'],
  ['rules', 'nav.rules', Rules, 'viewer'],
  ['simulator', 'nav.lab', Simulator, 'analyst'],
  ['account', 'nav.account', Account, 'viewer'],
];

export default function App() {
  const { t, lang } = useI18n();
  const [user, setUser] = useState(undefined);            // undefined = checking, null = signed out
  const [tab, setTab] = useState(() => window.location.hash.slice(1) || 'overview');

  useEffect(() => {
    api.me().then((r) => setUser(r.user), () => setUser(null));
    const out = () => setUser(null);
    const onHash = () => setTab(window.location.hash.slice(1) || 'overview');
    window.addEventListener('cart3r:unauthorized', out);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('cart3r:unauthorized', out);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  if (user === undefined) return <div className="login-wrap muted">{t('common.loading')}</div>;
  if (!user) return <Login onLogin={(u) => { setUser(u); setTab('overview'); }} />;

  const tabs = TABS.filter(([, , , role]) => can(user, role));
  const go = (id) => { window.location.hash = id; setTab(id); };
  const Page = (tabs.find(([id]) => id === tab) ?? tabs[0])[2];
  const logout = async () => { await api.logout().catch(() => {}); setUser(null); };

  return (
    <UserContext.Provider value={user}>
      <div className="app">
        <header className="topbar">
          <div className="brand">CART3R<span>: radar</span></div>
          <nav>
            {tabs.map(([id, key]) => (
              <button key={id} className={tab === id ? 'nav active' : 'nav'} onClick={() => go(id)}>{t(key)}</button>
            ))}
          </nav>
          <span className="muted">{user.email} · {t(`role.${user.role}`)}</span>
          <LangSwitch />
          <button className="btn ghost" onClick={logout}>{t('common.signOut')}</button>
        </header>
        {/* key={lang}: pages reload their data when the language changes (server texts are translated too) */}
        <main><Page key={lang} /></main>
      </div>
    </UserContext.Provider>
  );
}
