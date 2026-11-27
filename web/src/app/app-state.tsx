import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createLocalBackend } from '../data/localBackend';
import type { Backend } from '../data/backend';
import type { Dashboard, Profile } from '../data/types';
import { country } from '../lib/countries';
import { initialCountry, refreshCountry } from '../lib/geo';
import { fill, strings, type Lang, type Strings } from '../lib/i18n';
import { readString, writeString } from '../lib/storage';

type Theme = 'light' | 'dark';

interface AppState {
  t: Strings;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  /** Country whose currency amounts are shown in. */
  displayCountry: string;
  pickedCountry: boolean;
  setDisplayCountry: (cc: string) => void;
  displayCurrency: string;
  backend: Backend;
  user: Profile | null;
  setUser: (p: Profile | null) => void;
  dashboard: Dashboard | null;
  reloadDashboard: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string;
  hideBalance: boolean;
  setHideBalance: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AppProvider({ initialUser, children }: { initialUser: Profile | null; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (readString('chamaa-lang') === 'sw' ? 'sw' : 'en'));
  const t = useMemo(() => strings(lang), [lang]);
  const [theme, setTheme] = useState<Theme>(() => {
    const m = readString('chamaa-mode');
    return m === 'dark' || m === 'light' ? m : systemTheme();
  });
  const [geo, setGeo] = useState(initialCountry);
  const [picked, setPicked] = useState<string | null>(() => readString('chamaa-cc'));
  const [user, setUser] = useState<Profile | null>(initialUser);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [hideBalance, setHide] = useState(() => readString('chamaa-hide') === '1');

  const backend = useMemo(() => createLocalBackend((n) => fill(strings('en').welcomeN, { n })), []);

  useEffect(() => {
    const ac = new AbortController();
    refreshCountry(ac.signal).then((c) => c && setGeo(c));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    const meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach((m) => m.setAttribute('content', theme === 'dark' ? '#08132B' : '#EEF4FB'));
  }, [theme, lang]);

  const reloadDashboard = useCallback(async () => {
    if (!user) { setDashboard(null); return; }
    setDashboard(await backend.dashboard(user.id));
  }, [backend, user]);

  useEffect(() => { void reloadDashboard(); }, [reloadDashboard]);

  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(''), 2200);
    return () => clearTimeout(id);
  }, [toastMsg]);

  const displayCountry = picked || geo;
  const value: AppState = {
    t, lang,
    setLang: (l) => { setLangState(l); writeString('chamaa-lang', l); },
    theme,
    toggleTheme: () => setTheme((m) => { const n = m === 'dark' ? 'light' : 'dark'; writeString('chamaa-mode', n); return n; }),
    displayCountry,
    pickedCountry: !!picked,
    setDisplayCountry: (cc) => { setPicked(cc); writeString('chamaa-cc', cc); },
    displayCurrency: country(displayCountry)[3],
    backend, user, setUser, dashboard, reloadDashboard,
    toast: setToastMsg, toastMsg,
    hideBalance,
    setHideBalance: (v) => { setHide(v); writeString('chamaa-hide', v ? '1' : '0'); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const a = useContext(Ctx);
  if (!a) throw new Error('useApp outside AppProvider');
  return a;
}
