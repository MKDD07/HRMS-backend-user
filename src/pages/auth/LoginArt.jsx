import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { LoginCardVisual } from './LoginCardVisual';
import { Users, Clock3, CalendarDays, Wallet, FolderCheck, UserPlus, TrendingUp, HeartHandshake } from 'lucide-react';

const cards = [
  { icon: Users, label: 'PEOPLE', title: 'Connected by people.', detail: 'Built around your team.' },
  { icon: Clock3, label: 'ATTENDANCE', title: 'Every day, in sync.', detail: 'Make every moment count.' },
  { icon: CalendarDays, label: 'TIME OFF', title: 'Room to recharge.', detail: 'Plan together. Rest better.' },
  { icon: Wallet, label: 'PAYROLL', title: 'Clarity in every payday.', detail: 'Care that adds up.' },
  { icon: FolderCheck, label: 'DOCUMENTS', title: 'Everything in its place.', detail: 'Less searching. More doing.' },
  { icon: UserPlus, label: 'ONBOARDING', title: 'A warmer welcome.', detail: 'Great beginnings start here.' },
  { icon: TrendingUp, label: 'GROWTH', title: 'Small steps. Big futures.', detail: 'Grow stronger, together.' },
  { icon: HeartHandshake, label: 'CULTURE', title: 'People first. Always.', detail: 'A workplace that feels like you.' }
];

export function LoginArt() {
  const root = useRef(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(min-width: 801px) and (prefers-reduced-motion: no-preference)', () => {
      const slides = [...root.current.querySelectorAll('.login-art-card')];
      gsap.set(slides, { autoAlpha: 0, y: 32, rotation: 6, scale: 0.94 });
      gsap.set(slides[0], { autoAlpha: 1, y: 0, rotation: -4, scale: 1 });
      const loop = gsap.timeline({ repeat: -1 });
      slides.forEach((slide, i) => {
        const next = slides[(i + 1) % slides.length];
        const at = i * 4 + 3.2;
        loop.to(slide, { autoAlpha: 0, y: -30, rotation: -9, scale: 0.96, duration: 0.55, ease: 'power2.in' }, at)
          .fromTo(next, { autoAlpha: 0, y: 32, rotation: 6, scale: 0.94 }, { autoAlpha: 1, y: 0, rotation: -4, scale: 1, duration: 0.8, ease: 'power3.out', immediateRender: false }, at)
          .fromTo(next.querySelectorAll('.viz-mark'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.06, duration: 0.5, ease: 'power2.out', immediateRender: false }, at + 0.15);
      });
      const visibility = () => loop.paused(document.hidden);
      visibility();
      document.addEventListener('visibilitychange', visibility);
      return () => { document.removeEventListener('visibilitychange', visibility); };
    }, root);
    return () => media.revert();
  }, []);
  return <div className="login-art login-art-loop" ref={root}>
    <div aria-hidden="true">
      <span className="login-orbit orbit-one" /><span className="login-orbit orbit-two" />
      {cards.map(({ icon: Icon, label, title, detail }, index) => <div className="login-art-card" key={label}>
        <div className="login-art-heading"><span><Icon size={17} />{label}</span><small>{String(index + 1).padStart(2, '0')} / 08</small></div>
        <strong>{title}</strong><p>{detail}</p>
        <LoginCardVisual index={index} />
      </div>)}
    </div>
  </div>;
}
