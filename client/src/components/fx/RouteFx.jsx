import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Replays the page-enter fade and the crimson scan line on every navigation, and starts each page at the top.
// The admin and dine-in areas each share one key so their layouts stay mounted; the layouts animate their own content.
export default function RouteFx({ children }) {
  const { pathname } = useLocation();
  const area = ['/admin', '/dine'].find((p) => pathname === p || pathname.startsWith(`${p}/`));
  const key = area || pathname;

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <>
      <span key={`line-${pathname}`} className="route-line" aria-hidden="true" />
      <div key={key} className="route-fx">{children}</div>
    </>
  );
}
