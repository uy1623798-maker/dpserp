import { useEffect, useRef } from 'react';
import './HomeDepth.css';

export default function HomeDepth({ children }) {
  const root = useRef(null);
  useEffect(() => {
    const hero = root.current?.querySelector('.hero');
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
    if (!hero) return;
    let frame;
    const reset = () => {
      cancelAnimationFrame(frame);
      hero.style.setProperty('--rx', '0deg');
      hero.style.setProperty('--ry', '0deg');
    };
    const move = event => {
      if (media.matches) return;
      const box = hero.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        hero.style.setProperty('--rx', `${-y * 9}deg`);
        hero.style.setProperty('--ry', `${x * 12}deg`);
      });
    };
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', reset);
    media.addEventListener('change', reset);
    return () => {
      reset();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', reset);
      media.removeEventListener('change', reset);
    };
  }, []);
  return <div ref={root} className="home-depth">{children}</div>;
}
