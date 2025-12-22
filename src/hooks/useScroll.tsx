import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window or a container to the top on route change
 */
export function useScroll(options?: {
  behavior?: ScrollBehavior;
  container?: HTMLElement | null;
}) {
  const { pathname } = useLocation();

  const behavior = options?.behavior ?? "auto";
  const container = options?.container ?? null;

  useEffect(() => {
    if (container) {
      container.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, [pathname, behavior, container]);
}
