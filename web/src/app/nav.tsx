import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Route = 'welcome' | 'signup' | 'login' | 'forgot' | 'home' | 'chamas' | 'goals' | 'me' | 'pay' | 'invite' | 'stmt';

const ROOTS: Route[] = ['welcome', 'home', 'chamas', 'me'];
const SIGNED_IN: Route[] = ['home', 'chamas', 'goals', 'me', 'pay', 'invite', 'stmt'];

interface Nav {
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  reset: (r: Route) => void;
  /** Sheets register a closer so the phone's back button closes them first. */
  pushLayer: (close: () => void) => () => void;
}

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [route, setRoute] = useState<Route>(initial);
  const stack = useRef<Route[]>([]);
  const layers = useRef<Array<() => void>>([]);
  const routeRef = useRef(route);
  routeRef.current = route;

  const show = useCallback((r: Route, push: boolean) => {
    if (push && r !== routeRef.current) {
      if (ROOTS.includes(r)) stack.current = [];
      else stack.current.push(routeRef.current);
      try { history.pushState({ r }, ''); } catch { /* ignore */ }
    }
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    const prev = stack.current.pop();
    const cur = routeRef.current;
    show(prev ?? (SIGNED_IN.includes(cur) ? 'home' : cur === 'forgot' ? 'login' : 'welcome'), false);
  }, [show]);

  useEffect(() => {
    try { history.replaceState({ r: initial }, ''); } catch { /* ignore */ }
    const onPop = () => {
      const top = layers.current.pop();
      if (top) {
        top();
        try { history.pushState({ r: routeRef.current }, ''); } catch { /* ignore */ }
        return;
      }
      if (stack.current.length || !ROOTS.includes(routeRef.current)) back();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [back, initial]);

  const value = useMemo<Nav>(() => ({
    route,
    go: (r) => show(r, true),
    back,
    reset: (r) => { stack.current = []; show(r, false); },
    pushLayer: (close) => {
      layers.current.push(close);
      return () => { layers.current = layers.current.filter((c) => c !== close); };
    },
  }), [route, show, back]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): Nav {
  const n = useContext(Ctx);
  if (!n) throw new Error('useNav outside NavProvider');
  return n;
}
