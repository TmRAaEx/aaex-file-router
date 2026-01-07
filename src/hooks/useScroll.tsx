import { RefObject, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window or a container to the top on route change
 */
export function useScroll(options?: {
  behavior?: ScrollBehavior;
  container?: RefObject<HTMLElement | null>;
}) {
  const { pathname } = useLocation();

  const behavior = options?.behavior ?? "auto";
  const containerRef = options?.container;

  useEffect(() => {
    const el = containerRef?.current;

    if (el) {
      el.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, [pathname, behavior, containerRef]);
}
