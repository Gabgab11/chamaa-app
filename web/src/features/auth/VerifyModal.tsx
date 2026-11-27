import { useEffect, useState } from 'react';
import { useApp } from '../../app/app-state';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Sheet';
import { fill } from '../../lib/i18n';

export function VerifyModal({ email, onOk }: { email: string | null; onOk: () => void }) {
  const { t, backend, toast } = useApp();
  const [left, setLeft] = useState(30);

  useEffect(() => {
    if (!email) return;
    setLeft(30);
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [email]);

  return (
    <Modal open={!!email} labelledBy="vf-t">
      <div className="okc mail"><Icon name="mail" size={34} /></div>
      <h2 id="vf-t" className="disp">{t.vfT}</h2>
      <p className="muted">{t.vfS}<br /><b className="mail-to">{email}</b></p>
      <p className="muted small">{t.vfS2}</p>
      <button type="button" className="btn btn-pri" onClick={onOk} autoFocus>{t.vfOk}</button>
      <button type="button" className="link" disabled={left > 0} onClick={async () => { await backend.resendVerification(email!); setLeft(30); toast(t.sent); }}>
        {left > 0 ? fill(t.vfResend, { s: left }) : t.vfResendNow}
      </button>
    </Modal>
  );
}
