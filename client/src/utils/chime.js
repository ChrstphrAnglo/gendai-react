// Short two-tone alert for the kitchen and front desk, generated with Web Audio (no sound files).
// Browsers only allow audio after the page has been clicked once, so staff screens have a sound toggle.
const KEY = 'gendai:sound';
let ctx;

export const soundEnabled = () => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
};

export const setSoundEnabled = (on) => {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};

export function chime(kind = 'order') {
  if (!soundEnabled()) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = kind === 'payment' ? [880, 1320, 1760] : [660, 990];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.16;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}
