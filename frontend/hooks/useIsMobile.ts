'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when viewport width is below Tailwind's md breakpoint (>=768px).
 * This mirrors typical "mobile" behavior for responsive UI.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767.98px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}


