import { useMemo, useState } from 'react';
import { useApp } from '../app/app-state';
import { searchCountries } from '../lib/countries';
import { Sheet } from './Sheet';

export function CountrySheet({ open, onClose, onPick, title, showCurrency }: { open: boolean; onClose: () => void; onPick: (cc: string) => void; title: string; showCurrency?: boolean }) {
  const { t } = useApp();
  const [q, setQ] = useState('');
  const list = useMemo(() => searchCountries(q), [q]);
  return (
    <Sheet open={open} onClose={() => { setQ(''); onClose(); }} title={title}>
      <div className="field" style={{ marginBottom: 8 }}>
        <div className="in"><input type="search" placeholder={t.search} aria-label={t.search} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
      </div>
      <ul className="clist" role="listbox" aria-label={title}>
        {list.map(([cc, name, dial, cur]) => (
          <li key={cc}>
            <button type="button" role="option" aria-selected={false} onClick={() => { setQ(''); onPick(cc); }}>
              <span className="cc">{cc}</span>
              <span className="n">{name}</span>
              <span className="d">{showCurrency ? cur : `+${dial}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
