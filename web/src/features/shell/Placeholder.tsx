import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { TopBar } from '../../components/TopBar';

export function Placeholder({ title }: { title: string }) {
  const { t } = useApp();
  return (
    <main className="screen has-nav">
      <TopBar title={<h1 className="topbar-h">{title}</h1>} />
      <section className="card"><h2 className="card-t">{t.soonT}</h2><p className="muted small">{t.soon}</p></section>
    </main>
  );
}

export function MeScreen() {
  const { t, user, backend, setUser, toggleTheme, theme } = useApp();
  const nav = useNav();
  if (!user) return null;
  return (
    <main className="screen has-nav">
      <TopBar back={false} title={<h1 className="topbar-h">{t.nav[3]}</h1>} />
      <section className="card">
        <b>{user.firstName} {user.lastName}</b>
        <div className="muted small">{user.email}</div>
        <div className="muted small">{user.phone} · {user.city}</div>
      </section>
      <section className="card list">
        <button type="button" className="lrow" onClick={toggleTheme}>{theme === 'dark' ? t.light : t.dark}</button>
        <button type="button" className="lrow danger" onClick={async () => { await backend.logOut(); setUser(null); nav.reset('welcome'); }}>{t.logout}</button>
      </section>
      <section className="card"><h2 className="card-t">{t.soonT}</h2><p className="muted small">{t.soon}</p></section>
    </main>
  );
}
