import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function LoginHeadline({ welcome }) {
  const root = useRef(null);
  const phrases = [welcome || 'Your people. Your workplace. Together.', 'Great teams. Better days. Together.', 'Less admin. More human. Every day.', 'Small moments. Stronger teams.'];
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const lines = root.current.querySelectorAll('.login-headline-line');
      gsap.set(lines, { autoAlpha: 0, y: 24 });
      gsap.set(lines[0], { autoAlpha: 1, y: 0 });
      const loop = gsap.timeline({ repeat: -1 });
      lines.forEach((line, i) => {
        const at = i * 5 + 4.2;
        loop.to(line, { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, at)
          .fromTo(lines[(i + 1) % lines.length], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, at + 0.35);
      });
      const visibility = () => loop.paused(document.hidden);
      visibility(); document.addEventListener('visibilitychange', visibility);
      return () => document.removeEventListener('visibilitychange', visibility);
    }, root);
    return () => media.revert();
  }, [welcome]);
  return <h1 className="login-headline" ref={root} aria-label={phrases[0]}>{phrases.map((phrase, i) => <span aria-hidden="true" className="login-headline-line" key={i}>{phrase}</span>)}</h1>;
}
