import { useApp } from '../../app/app-state';
import { useNav, type Route } from '../../app/nav';
import { Icon, type IconName } from '../../components/Icon';
import { fill } from '../../lib/i18n';
import { useMoney } from './money';
import { useCountUp } from './useCountUp';

const ACTIONS: Array<{ icon: IconName; route: Route }> = [
  { icon: 'pay', route: 'pay' }, { icon: 'goals', route: 'goals' }, { icon: 'invite', route: 'invite' }, { icon: 'stmt', route: 'stmt' },
];

export function BalanceCard({ balance, weekIn, chamaCount, onCurrency }: { balance: number; weekIn: number; chamaCount: number; onCurrency: () => void }) {
  const { t, hideBalance, setHideBalance } = useApp();
  const nav = useNav();
  const m = useMoney();
  const shown = useCountUp(balance);
  const count = chamaCount === 0 ? t.noChamas : chamaCount === 1 ? t.chamaN : fill(t.chamasN, { n: chamaCount });
  return (
    <section className="hero balance" aria-label={t.avail}>
      <div className="bal-top">
        <span className="bal-l">
          <span>{t.avail}</span>
          <button type="button" className="eye-btn" aria-label={hideBalance ? t.showBal : t.hideBal} aria-pressed={hideBalance} onClick={() => setHideBalance(!hideBalance)}>
            <Icon name={hideBalance ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </span>
        <button type="button" className="curchip" onClick={onCurrency} aria-label={`${t.curT} ${m.currency}`}>{m.currency}<Icon name="chev" size={12} /></button>
      </div>
      <div className="amt" aria-live="polite">{hideBalance ? '••••••' : m.raw(shown)}</div>
      <div className="bal-meta">
        {weekIn > 0 ? <span className="pill lime">{fill(t.weekPill, { a: hideBalance ? '••••' : m.raw(weekIn) })}</span> : null}
        <span className="hero-muted">{count}</span>
      </div>
      <nav className="qa" aria-label="Quick actions">
        {ACTIONS.map((a, i) => (
          <button type="button" key={a.route} onClick={() => nav.go(a.route)}>
            <span className="qi"><Icon name={a.icon} /></span>{t.qa[i]}
          </button>
        ))}
      </nav>
    </section>
  );
}
