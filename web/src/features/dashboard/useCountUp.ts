import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates from the last shown value (or 0) up to `target` with an ease-out curve. */
export function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(reduced() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(target); from.current = target; return; }
    const start = performance.now(), a = from.current < target ? from.current : 0;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
