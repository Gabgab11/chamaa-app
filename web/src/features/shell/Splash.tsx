import { useEffect, useRef } from 'react';
import { useApp } from '../../app/app-state';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPIRAL = 'M124 140 A7 7 0 0 1 138 140 A14 14 0 0 1 110 140 A21 21 0 0 1 152 140 A28 28 0 0 1 96 140 A35 35 0 0 1 166 140';

/** Opening intro: a coin circles the name, drops into the piggy bank and the piggy shakes. Tap to skip. */
export function Splash({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const pig = useRef<SVGSVGElement>(null);
  const spiral = useRef<SVGPathElement>(null);
  const coin = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const sp = root.current!, w = word.current!, p = pig.current!, c = coin.current!, tg = tag.current!;
    let done = false;
    const timers: number[] = [];
    const anims: Animation[] = [];
    let raf = 0;
    const finish = () => {
      if (done) return;
      done = true;
      sp.classList.add('out');
      timers.push(window.setTimeout(() => doneRef.current(), 460));
    };
    sp.addEventListener('click', finish);

    if (reduced() || !sp.animate) {
      w.style.opacity = '1'; p.style.opacity = '1'; p.style.transform = 'none'; tg.style.opacity = '1';
      timers.push(window.setTimeout(finish, 900));
    } else {
      const R = sp.getBoundingClientRect(), wr = w.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const cx = wr.left - R.left + wr.width / 2, cy = wr.top - R.top + wr.height / 2, rx = wr.width / 2 + 26, ry = wr.height / 2 + 18;
      const s = 1 / 0.4; // pig rests at scale .4; work out its full-size box
      const pw = pr.width * s, ph = pr.height * s, pl = pr.left - R.left + pr.width / 2 - pw / 2, pt = pr.top - R.top + pr.height / 2 - ph / 2;
      const slotX = pl + (122 / 256) * pw, slotY = pt + (75 / 256) * ph;

      anims.push(w.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out', fill: 'forwards' }));

      // one and a half loops round the name, the coin flipping as it goes
      const N = 48, loops = 1.5, a0 = Math.PI, frames: Keyframe[] = [];
      let ex = 0, ey = 0;
      for (let i = 0; i <= N; i++) {
        const q = i / N, a = a0 + q * loops * 2 * Math.PI, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a) * 0.9, front = Math.sin(a) > 0;
        frames.push({ transform: `translate(${x}px,${y}px) scaleX(${(Math.abs(Math.cos(a * 2)) * 0.7 + 0.3).toFixed(2)}) scale(${front ? 1 : 0.82})`, opacity: 1, offset: q });
        if (i === N) { ex = x; ey = y; }
      }
      c.style.opacity = '1';
      const orbit = c.animate(frames, { duration: 1500, delay: 350, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      anims.push(orbit);

      // the coin goes behind the word on the far side of the loop
      const t0 = performance.now() + 350;
      const layer = () => {
        if (done) return;
        const q = Math.min(1, Math.max(0, (performance.now() - t0) / 1500));
        c.classList.toggle('back', Math.sin(a0 + q * loops * 2 * Math.PI) < 0 && q < 1);
        if (q < 1) raf = requestAnimationFrame(layer);
      };
      raf = requestAnimationFrame(layer);

      orbit.finished.then(() => {
        if (done) return;
        anims.push(p.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: 'ease-out', fill: 'forwards' }));
        const midX = (ex + slotX) / 2, midY = Math.min(ey, slotY) - 70;
        const fly = c.animate([
          { transform: `translate(${ex}px,${ey}px) scale(1)` },
          { transform: `translate(${midX}px,${midY}px) scale(1.15) rotate(-20deg)`, offset: 0.55 },
          { transform: `translate(${slotX}px,${slotY - 16}px) scale(1) rotate(0deg) scaleX(.35)`, offset: 0.85 },
          { transform: `translate(${slotX}px,${slotY + 6}px) scale(.8) scaleX(.2)`, opacity: 0 },
        ], { duration: 820, delay: 220, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
        anims.push(fly);
        return fly.finished.then(() => {
          if (done) return;
          // the piggy shakes as the coin lands
          anims.push(p.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06,.92) translateY(4px)' }, { transform: 'scale(.98,1.04) translateY(-6px)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' }));
          if (spiral.current) anims.push(spiral.current.animate([{ strokeWidth: 9 }, { strokeWidth: 13 }, { strokeWidth: 9 }], { duration: 480 }));
          anims.push(tg.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 150, fill: 'forwards' }));
          timers.push(window.setTimeout(finish, 1150));
        });
      }).catch(() => undefined);
    }

    return () => {
      done = true;
      sp.removeEventListener('click', finish);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div className="splash" ref={root} role="img" aria-label="Chamaa">
      <div className="sp-stack">
        <svg ref={pig} className="sp-pig" viewBox="0 0 256 256" aria-hidden="true">
          <ellipse fill="var(--pig)" cx="124" cy="136" rx="92" ry="74" />
          <path fill="var(--pig)" d="M164 74 L190 44 L196 92 Z" />
          <rect fill="var(--pig)" x="200" y="114" width="34" height="42" rx="12" />
          <rect fill="var(--pig)" x="66" y="186" width="28" height="44" rx="8" />
          <rect fill="var(--pig)" x="148" y="186" width="28" height="44" rx="8" />
          <rect fill="var(--bg)" x="100" y="70" width="44" height="10" rx="5" />
          <path ref={spiral} d={SPIRAL} fill="none" stroke="var(--lime)" strokeWidth="9" strokeLinecap="round" />
        </svg>
        <div ref={word} className="sp-word">chamaa</div>
        <div ref={tag} className="sp-tag">{t.tag.replace('\n', ' ')}</div>
      </div>
      <div ref={coin} className="sp-coin" aria-hidden="true">
        <svg viewBox="0 0 26 26" width="26" height="26">
          <circle cx="13" cy="13" r="12" fill="#C6F432" stroke="#0B1B3F" strokeWidth="2" />
          <circle cx="13" cy="13" r="7.5" fill="none" stroke="#0B1B3F" strokeWidth="1.4" opacity=".55" />
          <path d="M15.6 10.4a3.6 3.6 0 1 0 0 5.2" fill="none" stroke="#0B1B3F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
