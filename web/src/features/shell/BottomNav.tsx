import { useApp } from '../../app/app-state';
import { useNav, type Route } from '../../app/nav';
import { Icon, type IconName } from '../../components/Icon';

const TABS: Array<{ r: Route; icon: IconName }> = [{ r: 'home', icon: 'home' }, { r: 'chamas', icon: 'chamas' }, { r: 'goals', icon: 'goals' }, { r: 'me', icon: 'me' }];

export function BottomNav() {
  const { t } = useApp();
  const nav = useNav();
  const tab = (i: number) => {
    const x = TABS[i];
    return (
      <button type="button" key={x.r} aria-current={nav.route === x.r ? 'page' : undefined} onClick={() => nav.go(x.r)}>
        <Icon name={x.icon} />{t.nav[i]}
      </button>
    );
  };
  return (
    <nav className="bnav" aria-label="Main">
      {tab(0)}{tab(1)}
      <button type="button" className="plus" aria-label={t.qa[0]} onClick={() => nav.go('pay')}><Icon name="plus" size={24} stroke={2.2} /></button>
      {tab(2)}{tab(3)}
    </nav>
  );
}
