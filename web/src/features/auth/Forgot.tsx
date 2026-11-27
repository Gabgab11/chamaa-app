import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/app-state';
import { useNav } from '../../app/nav';
import { Field, FormError } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { TopBar } from '../../components/TopBar';
import { fill } from '../../lib/i18n';
import { emailOk } from '../../lib/validate';

export function Forgot() {
  const { t, backend } = useApp();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!emailOk(email)) return setErr(t.eEmail);
    await backend.requestPasswordReset(email);
    setSent(true);
  }

  return (
    <main className="screen">
      <TopBar />
      <h1 className="disp h1">{t.fgT}</h1>
      {sent ? (
        <div className="card center done-card">
          <div className="okc"><Icon name="check" size={30} stroke={2.6} /></div>
          <p>{fill(t.fgSent, { e: email.trim() })}</p>
          <button type="button" className="btn btn-pri" onClick={() => nav.back()}>{t.backLogin}</button>
        </div>
      ) : (
        <>
          <p className="muted lead">{t.fgS}</p>
          <form noValidate onSubmit={submit}>
            <Field label={t.email} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" value={email} onChange={(e) => { setErr(''); setEmail(e.target.value); }} autoFocus />
            <FormError msg={err} />
            <button type="submit" className="btn btn-pri">{t.fgBtn}</button>
          </form>
        </>
      )}
    </main>
  );
}
