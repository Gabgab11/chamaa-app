import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useNav } from '../app/nav';
import { useApp } from '../app/app-state';
import { Icon } from './Icon';

/** Bottom sheet with a close button, tap-outside, Escape and phone-back support. */
export function Sheet({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode }) {
  const { pushLayer } = useNav();
  const { t } = useApp();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const close = () => closeRef.current();
    const pop = pushLayer(close);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { pop(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, pushLayer]);

  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={panel} tabIndex={-1}>
        <span className="grab" aria-hidden="true" />
        <div className="sheet-h">
          <h2 id={id}>{title}</h2>
          {actions}
          <button type="button" className="icon-btn sm" aria-label={t.close} onClick={onClose}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Centered dialog (verification email etc.). */
export function Modal({ open, children, labelledBy }: { open: boolean; children: ReactNode; labelledBy: string }) {
  if (!open) return null;
  return (
    <div className="sheet-bg center">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
    </div>
  );
}
