import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { CountrySheet } from '../../components/CountrySheet';
import { Field, FormError, PasswordField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { TopBar } from '../../components/TopBar';
import { country } from '../../lib/countries';
import { emailOk, nameOk, passwordOk, phoneDigits, phoneOk } from '../../lib/validate';
import { VerifyModal } from './VerifyModal';

export function SignUp({ withInvite, onDone }: { withInvite: boolean; onDone: (email: string) => void }) {
  const { t, backend, displayCountry } = useApp();
  const nav = useNav();
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', city: '', pw: '', invite: '', terms: false });
  const [cc, setCc] = useState(displayCountry);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) => {
    setErr('');
    setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? !!e.target.checked : e.target.value }));
  };
  const c = country(cc);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fail = (m: string, name: string) => { setErr(m); (form.elements.namedItem(name) as HTMLElement | null)?.focus(); };
    if (!nameOk(f.first)) return fail(t.eFirst, 'first');
    if (!nameOk(f.last)) return fail(t.eLast, 'last');
    if (!emailOk(f.email)) return fail(t.eEmail, 'email');
    if (!phoneOk(f.phone)) return fail(t.ePhone, 'phone');
    if (!f.city.trim()) return fail(t.eCity, 'city');
    if (!passwordOk(f.pw)) return fail(t.ePw, 'pw');
    if (!f.terms) return fail(t.eTerms, 'terms');
    setBusy(true);
    const r = await backend.signUp({
      firstName: f.first, lastName: f.last, email: f.email, phone: `+${c[2]}${phoneDigits(f.phone)}`,
      city: f.city, country: cc, password: f.pw, inviteCode: f.invite.trim() || undefined,
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error === 'email_exists' ? t.eExists : t.eCreds);
    setSentTo(r.value.email);
  }

  return (
    <main className="screen">
      <TopBar />
      <h1 className="disp h1">{t.suT}</h1>
      <p className="muted lead">{t.suS}</p>
      <form noValidate onSubmit={submit}>
        <div className="two">
          <Field label={t.first} name="first" autoComplete="given-name" value={f.first} onChange={set('first')} maxLength={60} />
          <Field label={t.last} name="last" autoComplete="family-name" value={f.last} onChange={set('last')} maxLength={60} />
        </div>
        <Field label={t.email} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} value={f.email} onChange={set('email')} />
        <Field
          label={t.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={set('phone')} maxLength={18}
          adornment={<button type="button" className="dial" onClick={() => setPicking(true)} aria-label={`${t.pickCountry}: ${c[1]} +${c[2]}`}><span className="cc">{c[0]}</span>+{c[2]}<Icon name="chev" size={14} /></button>}
        />
        <Field label={t.city} name="city" autoComplete="address-level2" value={f.city} onChange={set('city')} maxLength={60} />
        <PasswordField label={t.newpw} name="pw" autoComplete="new-password" value={f.pw} onChange={set('pw')} hint={t.pwHint} />
        {withInvite ? <Field label={<>{t.invCode} <span className="opt">{t.optional}</span></>} name="invite" autoCapitalize="characters" value={f.invite} onChange={set('invite')} maxLength={20} /> : null}
        <label className="chk">
          <input type="checkbox" name="terms" checked={f.terms} onChange={set('terms')} />
          <span>{t.terms}</span>
        </label>
        <FormError msg={err} />
        <button type="submit" className="btn btn-pri" disabled={busy}>{t.create}</button>
      </form>
      <p className="center muted foot">{t.have} <button type="button" className="link inline" onClick={() => nav.go('login')}>{t.login}</button></p>
      <CountrySheet open={picking} title={t.pickCountry} onClose={() => setPicking(false)} onPick={(x) => { setCc(x); setPicking(false); }} />
      <VerifyModal email={sentTo} onOk={() => { const e = sentTo!; setSentTo(null); onDone(e); }} />
    </main>
  );
}
