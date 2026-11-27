import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { ThemeButton } from '../../components/TopBar';
import { LogoLockup } from '../../components/LogoLockup';

export function Welcome({ onInvite }: { onInvite: () => void }) {
  const { t, lang, setLang } = useApp();
  const nav = useNav();
  return (
    <main className="screen welcome">
      <header className="topbar"><span /><span className="grow" /><div className="topbar-r"><ThemeButton /></div></header>
      <div className="welcome-body">
        <div className="logo-tile"><LogoLockup width={196} /></div>
        <h1 className="disp tag">{t.tag.split('\n').map((l) => <span key={l}>{l}<br /></span>)}</h1>
        <p className="muted sub">{t.sub}</p>
      </div>
      <div className="stack">
        <button type="button" className="btn btn-pri" onClick={() => nav.go('signup')}>{t.create}</button>
        <button type="button" className="btn btn-sec" onClick={() => nav.go('login')}>{t.login}</button>
        <button type="button" className="link" onClick={onInvite}>{t.inv}</button>
        <div className="seg" role="group" aria-label="Language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button type="button" aria-pressed={lang === 'sw'} onClick={() => setLang('sw')}>Kiswahili</button>
        </div>
      </div>
    </main>
  );
}
