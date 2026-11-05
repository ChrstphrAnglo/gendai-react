import { useState } from 'react';
import { chime, setSoundEnabled, soundEnabled } from '../../utils/chime';

// Browsers only play sound after a click, so this button doubles as the "unlock audio" tap.
export default function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    if (next) chime('order');
  };
  return (
    <button type="button" className={`btn btn-ghost btn-sm sound-toggle ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on}>
      {on ? '🔔 Sound on' : '🔕 Sound off'}
    </button>
  );
}
