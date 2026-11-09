"use client";
// Motion, kept small: anime.js for the one entrance per screen and for figures that change; GSAP's
// ScrollSmoother for scrolling (components/SmoothScroll.tsx). One easing curve and short durations
// (unslop tokens). Everything stops for prefers-reduced-motion.
import { animate, cubicBezier, stagger, utils } from "animejs";

export const EASE = cubicBezier(0.22, 1, 0.36, 1);

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades and lifts the `[data-enter]` blocks inside `root`, 50 ms apart, at most six of them. */
export function enter(root: Element | null) {
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-enter]")).slice(0, 6);
  if (!items.length || reducedMotion()) return;
  const a = animate(items, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(50), ease: EASE });
  return () => {
    a.revert();
  };
}

/** Tweens the number shown in `el` from its last value to `to`, formatted by `format`. */
export function countTo(el: HTMLElement | null, from: number, to: number, format: (n: number) => string) {
  if (!el) return;
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const state = { n: from };
  const a = animate(state, {
    n: to,
    duration: 600,
    ease: EASE,
    modifier: utils.round(0),
    onUpdate: () => {
      el.textContent = format(state.n);
    },
  });
  return () => {
    a.cancel();
  };
}
