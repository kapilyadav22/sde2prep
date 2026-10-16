'use client';
import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export function FullscreenButton() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.focus = String(active);
    return () => { delete document.documentElement.dataset.focus; };
  }, [active]);
  useEffect(() => {
    const changed = () => setActive(Boolean(document.fullscreenElement));
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActive(false); };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('fullscreenchange', changed); document.removeEventListener('keydown', escape); };
  }, []);
  async function toggle() {
    if (active) {
      setActive(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } else {
      setActive(true);
      // The full-width reading layout also works on browsers without Fullscreen API support.
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }
  return <button type="button" className="button fullscreen-button" aria-pressed={active} onClick={toggle}>
    {active ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<span>{active ? 'Exit fullscreen' : 'Fullscreen'}</span>
  </button>;
}
