import { useMemo, useState } from 'react';
import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { CountrySheet } from '../../components/CountrySheet';
import { Icon } from '../../components/Icon';
import { ThemeButton } from '../../components/TopBar';
import { country } from '../../lib/countries';
import { fill } from '../../lib/i18n';
import { BalanceCard } from './BalanceCard';
import { useMoney } from './money';
import { Notifications } from './Notifications';

const WEEK = 7 * 24 * 3600 * 1000;

export function Home() {
  const app = useApp();
  const { t, user, dashboard, displayCountry, pickedCountry, toast } = app;
  const nav = useNav();
  const m = useMoney();
  const [curOpen, setCurOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const d = dashboard;

  const { balance, weekIn } = useMemo(() => {
    if (!d) return { balance: 0, weekIn: 0 };
    const now = Date.now();
    const inn = d.payments.filter((p) => p.mine).reduce((a, p) => a + m.toDisplay(p.amount, p.currency), 0);
    const out = d.payouts.filter((p) => p.mine).reduce((a, p) => a + m.toDisplay(p.amount, p.currency), 0);
    const wk = d.payments.filter((p) => p.mine && now - p.at < WEEK).reduce((a, p) => a + m.toDisplay(p.amount, p.currency), 0);
    return { balance: Math.max(0, inn - out), weekIn: wk };
  }, [d, m]);

  if (!user) return null;
  const unread = d ? d.notices.filter((n) => !n.read).length : 0;
  const c = country(displayCountry);
  const next = d?.chamas.find((ch) => ch.myStatus !== 'paid');
  const goal = d?.goals[0];
  const initials = ((user.firstName[0] || '') + (user.lastName[0] || '')).toUpperCase() || '#';
  const due = (iso: string) => new Date(iso).toLocaleDateString(m.locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="screen has-nav">
      <header className="hd">
        <div className="av me" aria-hidden="true">{initials}</div>
        <div className="grow"><div className="muted small">{t.hi}</div><div className="hd-name">{user.firstName}</div></div>
        <ThemeButton />
        <button type="button" className="icon-btn" aria-label={unread ? `${t.notifT} (${unread})` : t.notifT} onClick={() => setNotesOpen(true)}>
          <Icon name="bell" />{unread ? <b className="badge">{unread > 9 ? '9+' : unread}</b> : null}
        </button>
      </header>

      <BalanceCard balance={balance} weekIn={weekIn} chamaCount={d?.chamas.length ?? 0} onCurrency={() => setCurOpen(true)} />
      <p className="locnote">{fill(pickedCountry ? t.locPick : t.loc, { cur: c[3], country: c[1] })}</p>

      {!d || d.chamas.length === 0 ? (
        <section className="card">
          <h2 className="card-t">{t.noChT}</h2>
          <p className="muted small">{t.noChS}</p>
          <div className="two">
            <button type="button" className="btn btn-pri sm" onClick={() => toast(t.soon)}>{t.chNew}</button>
            <button type="button" className="btn btn-sec sm" onClick={() => toast(t.soon)}>{t.chJoin}</button>
          </div>
        </section>
      ) : next ? (
        <>
          <div className="sec"><span>{t.next}</span><button type="button" className="link inline" onClick={() => nav.go('chamas')}>{t.all}</button></div>
          <section className="card row">
            <div className="av ch" aria-hidden="true">{next.initials}</div>
            <div className="grow"><b>{next.name}</b><div className="muted small">{fill(t.dueIn, { d: due(next.dueAt) })} · {m.show(next.contribution, next.currency)}</div></div>
            <button type="button" className="btn-sm pri" onClick={() => nav.go('pay')}>{t.pay}</button>
          </section>
        </>
      ) : (
        <section className="card"><b>✓ {t.allPaid}</b><p className="muted small">{t.allPaidS}</p></section>
      )}

      {goal ? (
        <section className="goal">
          <div className="goal-h"><b>{goal.name}</b><span className="disp pct">{Math.min(100, Math.round((goal.saved / goal.target) * 100))}%</span></div>
          <div className="bar"><i style={{ width: `${Math.min(100, (goal.saved / goal.target) * 100)}%` }} /></div>
          <div className="small">{m.show(goal.saved, goal.currency)} {t.of} {m.show(goal.target, goal.currency)} · {t.by} {due(goal.date)}</div>
        </section>
      ) : (
        <button type="button" className="goal empty" onClick={() => nav.go('goals')}>
          <b>{t.noGoalT}</b><span className="small">{t.noGoalS}</span>
        </button>
      )}

      <p className="muted small note">{t.demoNote}</p>

      <CountrySheet open={curOpen} title={t.curT} showCurrency onClose={() => setCurOpen(false)} onPick={(cc) => { app.setDisplayCountry(cc); setCurOpen(false); }} />
      <Notifications
        open={notesOpen}
        onClose={() => { setNotesOpen(false); if (user && unread) void app.backend.markNoticesRead(user.id).then(app.reloadDashboard); }}
        notices={d?.notices ?? []}
        onMarkAll={() => { void app.backend.markNoticesRead(user.id).then(app.reloadDashboard); }}
      />
    </main>
  );
}
