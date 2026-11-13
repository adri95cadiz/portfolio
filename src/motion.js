import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/** Split plain-text headings into word spans. The heading keeps an unsplit accessible name. */
export function splitWords(root = document) {
  for (const el of root.querySelectorAll('[data-split]')) {
    if (el.children.length) continue; // never split inline markup
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    const words = text.split(/\s+/);
    for (const [i, word] of words.entries()) {
      const outer = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.textContent = word;
      outer.append(inner);
      el.append(outer, i < words.length - 1 ? ' ' : '');
    }
  }
}

export function startSmoothScroll() {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  // keep GSAP's default lag smoothing: with lagSmoothing(0) any long frame (shader compile, GC) fast-forwards intros
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      history.replaceState(null, '', a.getAttribute('href'));
    });
  }
  return () => { gsap.ticker.remove(tick); lenis.destroy(); };
}

/** @param {{ reveal: number }} [signal] state object of the hero oscilloscope trace */
export function heroIntro(signal) {
  // created paused: it starts once the 3D scene has compiled, otherwise that stall swallows the whole intro
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 1.3 } });
  if (signal) tl.fromTo(signal, { reveal: 0 }, { reveal: 1, duration: 2.4, ease: 'power2.inOut' }, 0);
  tl.from('.hero__title .w > span', { yPercent: 110, stagger: 0.08 }, 0.15)
    .from('.hero__eyebrow', { opacity: 0, y: 12, duration: 0.8 }, 0.1)
    .from('.hero__readout, .hero__scope', { opacity: 0, duration: 1.2 }, 0.3)
    .from('.hero__foot > *', { opacity: 0, y: 24, stagger: 0.1 }, 0.9)
    .from('.nav, .hud', { opacity: 0, duration: 1 }, 0.6)
    // the logo is drawn like a signal trace, then the chromatic ghosts glitch in
    .from('.logo .l-main', { strokeDashoffset: 100, duration: 1.6, ease: 'power2.inOut' }, 0.5)
    .from('.logo .l-ghost', { opacity: 0, duration: 0.05 }, 1.9)
    .fromTo('.logo .l-ghost--a', { x: -21 }, { x: -7, duration: 0.45, ease: 'steps(5)' }, 1.9)
    .fromTo('.logo .l-ghost--b', { x: 21 }, { x: 7, duration: 0.45, ease: 'steps(5)' }, 1.9);
  return tl;
}

export function chapterReveals() {
  for (const ch of document.querySelectorAll('.chapter:not(.hero)')) {
    const words = ch.querySelectorAll('h2 .w > span');
    const rest = [...ch.children].filter((el) => el.tagName !== 'H2' && !el.classList.contains('projects'));
    gsap.timeline({ scrollTrigger: { trigger: ch, start: 'top 72%', once: true }, defaults: { ease: 'expo.out' } })
      .from(words, { yPercent: 110, duration: 1.2, stagger: 0.06 })
      .from(rest, { opacity: 0, y: 32, duration: 1, stagger: 0.09 }, 0.25);
  }
  for (const p of document.querySelectorAll('.project')) {
    gsap.from(p, {
      opacity: 0, y: 60, rotate: p.matches(':nth-child(even)') ? 1.5 : -1.5, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: p, start: 'top 82%', once: true },
    });
  }
}

/**
 * Tracks which chapter (and project) is on screen and reports its accent.
 * @param {(info:{accent:string, ch:string, name:string, id:string}) => void} onChange
 */
export function trackChapters(onChange) {
  let chapter = null;
  let project = null;
  const emit = () => {
    if (!chapter) return;
    onChange({
      accent: (project ?? chapter).dataset.accent,
      ch: chapter.dataset.ch, name: chapter.dataset.name, id: chapter.id,
    });
  };
  for (const el of document.querySelectorAll('.chapter')) {
    ScrollTrigger.create({
      trigger: el, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) { chapter = el; emit(); } },
    });
  }
  for (const el of document.querySelectorAll('.project')) {
    ScrollTrigger.create({
      trigger: el, start: 'top 65%', end: 'bottom 35%',
      onToggle: (self) => {
        if (self.isActive) project = el;
        else if (project === el) project = null;
        emit();
      },
    });
  }
}

export { gsap, ScrollTrigger };
