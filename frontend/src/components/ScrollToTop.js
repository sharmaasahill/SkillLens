import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Opens every new page at the top. Without this, a link clicked low on one page (like the footer's
 * Privacy Policy link) opens the next page at the same scroll position, near its bottom.
 * The browser's Back and Forward buttons are left alone, so they return to where you were.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return null;
}

export default ScrollToTop;
