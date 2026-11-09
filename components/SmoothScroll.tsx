"use client";
import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother);

/**
 * GSAP ScrollSmoother around the content column (the header and sidebar stay outside, fixed).
 * Off for touch screens and for prefers-reduced-motion, where native scrolling is better.
 * Scroll goes back to the top on every route change.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
        const smoother = ScrollSmoother.create({
          wrapper: wrapper.current!,
          content: content.current!,
          smooth: 0.9,
          effects: false,
          normalizeScroll: false,
          smoothTouch: false,
        });
        return () => smoother.kill();
      });
      return () => mm.revert();
    },
    { scope: wrapper },
  );

  useGSAP(
    () => {
      const s = ScrollSmoother.get();
      if (s) s.scrollTo(0, false);
      else window.scrollTo({ top: 0 });
      ScrollTrigger.refresh();
    },
    { dependencies: [pathname] },
  );

  return (
    <div ref={wrapper} id="smooth-wrapper">
      <div ref={content} id="smooth-content" className="shell-content">
        <div className="shell-inner">{children}</div>
      </div>
    </div>
  );
}
