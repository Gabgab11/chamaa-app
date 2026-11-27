import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { Field, FormError, PasswordField } from '../../components/Field';
import { TopBar } from '../../components/TopBar';
import { emailOk } from '../../lib/validate';

export function LogIn({ prefillEmail }: { prefillEmail: string }) {
  const { t, backend, setUser } = useApp();
  const nav = useNav();
  const [email, setEmail] = useState(prefillEmail);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!emailOk(email) || !pw) return setErr(t.eLogin);
    setBusy(true);
    const r = await backend.logIn(email, pw);
    setBusy(false);
    if (!r.ok) return setErr(r.error === 'email_not_verified' ? t.eUnverified : t.eCreds);
    setUser(r.value);
    nav.reset('home');
  }

  return (
    <main className="screen">
      <TopBar />
      <h1 className="disp h1">{t.liT}</h1>
      <p className="muted lead">{t.liS}</p>
      <form noValidate onSubmit={submit}>
        <Field label={t.email} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} value={email} onChange={(e) => { setErr(''); setEmail(e.target.value); }} autoFocus={!prefillEmail} />
        <PasswordField label={t.pw} autoComplete="current-password" value={pw} onChange={(e) => { setErr(''); setPw(e.target.value); }} autoFocus={!!prefillEmail} />
        <div className="right"><button type="button" className="link inline" onClick={() => nav.go('forgot')}>{t.forgot}</button></div>
        <FormError msg={err} />
        <button type="submit" className="btn btn-pri" disabled={busy}>{t.login}</button>
      </form>
      <p className="center muted foot">{t.newTo} <button type="button" className="link inline" onClick={() => nav.go('signup')}>{t.create}</button></p>
    </main>
  );
}
