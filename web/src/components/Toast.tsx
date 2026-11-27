import { useApp } from '../app/app-state';

export function Toast() {
  const { toastMsg } = useApp();
  return <div className={`toast${toastMsg ? ' on' : ''}`} role="status" aria-live="polite">{toastMsg}</div>;
}
