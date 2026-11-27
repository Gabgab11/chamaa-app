import { useApp } from '../../app/app-state';
import { Sheet } from '../../components/Sheet';
import type { Notice } from '../../data/types';
import { fill } from '../../lib/i18n';

const COLOUR: Record<Notice['kind'], string> = { pay: 'var(--ok)', remind: 'var(--pri)', payout: 'var(--lime)', join: 'var(--pri)', goal: 'var(--lime)', swap: 'var(--pri)', late: 'var(--coral)' };

export function Notifications({ open, onClose, notices, onMarkAll }: { open: boolean; onClose: () => void; notices: Notice[]; onMarkAll: () => void }) {
  const { t } = useApp();
  const now = Date.now();
  const ago = (at: number) => {
    const m = Math.floor((now - at) / 60000);
    if (m < 1) return t.justNow;
    if (m < 60) return fill(t.minAgo, { n: m });
    const h = Math.floor(m / 60);
    return h < 24 ? fill(t.hAgo, { n: h }) : fill(t.dAgo, { n: Math.floor(h / 24) });
  };
  return (
    <Sheet open={open} onClose={onClose} title={t.notifT} actions={notices.some((n) => !n.read) ? <button type="button" className="link inline markall" onClick={onMarkAll}>{t.markAll}</button> : undefined}>
      {notices.length === 0 ? <p className="muted">{t.noNotes}</p> : (
        <ul className="nlist">
          {notices.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <span className="dot" style={{ background: n.read ? 'var(--line)' : COLOUR[n.kind] }} />
              <span className="tx">{n.text}<small>{ago(n.at)}</small></span>
              {!n.read ? <span className="new">{t.newTag}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
