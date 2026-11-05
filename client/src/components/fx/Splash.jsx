import { useEffect, useState } from 'react';

const SEEN_KEY = 'gendai:splash';

const alreadySeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

// Short brand intro shown once per browser session: the red sun rises, 現代 is inked in,
// then the paper splits open. Click anywhere to skip.
export default function Splash() {
  const [phase, setPhase] = useState(() => (alreadySeen() ? 'done' : 'show'));

  useEffect(() => {
    if (phase !== 'show') return undefined;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
    const leave = setTimeout(() => setPhase('leaving'), 1700);
    return () => clearTimeout(leave);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const done = setTimeout(() => setPhase('done'), 1050);
    return () => clearTimeout(done);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div className={`splash ${phase === 'leaving' ? 'leaving' : ''}`} onClick={() => setPhase('leaving')} aria-hidden="true">
      <div className="splash-panel top" />
      <div className="splash-panel bottom" />
      <div className="splash-core">
        <div className="splash-mark">
          <span className="splash-ring" />
          <span className="splash-sun fx-sun" />
          <span className="splash-kanji">現代</span>
        </div>
        <span className="splash-word">GENDAI</span>
        <span className="splash-bar" />
      </div>
    </div>
  );
}
