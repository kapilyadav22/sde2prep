'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let preference: string | null = null;
      try { preference = localStorage.getItem('sde2prep-theme'); } catch {}
      const next = preference ? preference === 'dark' : media.matches;
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      setDark(next);
    };
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('sde2prep-theme', next ? 'dark' : 'light'); } catch {}
  }
  return <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} title={`Switch to ${dark ? 'light' : 'dark'} theme`}>
    {dark ? <Sun size={19}/> : <Moon size={19}/>}
  </button>;
}
