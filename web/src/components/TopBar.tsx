import type { ReactNode } from 'react';
import { useApp } from '../app/app-state';
import { useNav } from '../app/nav';
import { Icon } from './Icon';

export function ThemeButton() {
  const { theme, toggleTheme, t } = useApp();
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t.light : t.dark}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function TopBar({ back = true, title, right }: { back?: boolean; title?: ReactNode; right?: ReactNode }) {
  const nav = useNav();
  const { t } = useApp();
  return (
    <header className="topbar">
      {back ? (
        <button type="button" className="icon-btn" aria-label={t.back} onClick={nav.back}><Icon name="back" size={18} /></button>
      ) : <span />}
      {title ? <div className="topbar-t">{title}</div> : <span className="grow" />}
      <div className="topbar-r">{right ?? <ThemeButton />}</div>
    </header>
  );
}
