import { useEffect } from 'react';

// Fades in any element marked `data-reveal` when it scrolls into view.
// Mounted once in App; a MutationObserver picks up elements that render later (e.g. after a fetch).
// Optional stagger: style={{ '--d': index }}.
export default function useRevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (!('IntersectionObserver' in window)) return undefined;
    root.classList.add('fx-on');

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const scan = () => document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    scan();

    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove('fx-on');
    };
  }, []);
}
