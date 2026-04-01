"use client";

/**
 * Scroll-triggered reveal animation (GSAP + ScrollTrigger).
 * Pattern from React Bits — https://reactbits.dev
 */

import { useEffect, useRef, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Direction = "vertical" | "horizontal";

export type AnimatedContentProps = {
  children: ReactNode;
  /** Scroll container element, selector string, or omit for viewport */
  container?: HTMLElement | string | null;
  distance?: number;
  direction?: Direction;
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  threshold?: number;
  delay?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

export function AnimatedContent({
  children,
  container,
  distance = 100,
  direction = "vertical",
  reverse = false,
  duration = 0.8,
  ease = "power3.out",
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power3.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  style: propStyle,
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let scrollerTarget: HTMLElement | Window | string | null =
      container ?? (typeof document !== "undefined" ? document.getElementById("snap-main-container") : null);

    if (typeof scrollerTarget === "string") {
      scrollerTarget = document.querySelector(scrollerTarget) as HTMLElement | null;
    }

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;
    const startPct = (1 - threshold) * 100;

    gsap.set(el, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: "visible",
      force3D: true,
    });

    const tl = gsap.timeline({
      paused: true,
      delay,
      onComplete: () => {
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(el, {
            [axis]: reverse ? distance : -distance,
            scale: 0.8,
            opacity: animateOpacity ? initialOpacity : 0,
            delay: disappearAfter,
            duration: disappearDuration,
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          });
        }
      },
    });

    tl.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
      force3D: true,
    });

    const stVars: ScrollTrigger.Vars = {
      trigger: el,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => {
        tl.play();
      },
    };
    if (scrollerTarget instanceof HTMLElement) {
      stVars.scroller = scrollerTarget;
    }

    const st = ScrollTrigger.create(stVars);

    return () => {
      st.kill();
      tl.kill();
    };
  }, [
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    onComplete,
    onDisappearanceComplete,
  ]);

  return (
    <div ref={ref} className={className} style={{ visibility: "hidden", ...propStyle }} {...props}>
      {children}
    </div>
  );
}
