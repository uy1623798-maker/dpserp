import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const storageKey = 'dps-theme';

function preferredTheme() {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    setTheme(preferredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme]);

  const dark = theme === 'dark';
  return <button
    type="button"
    className="theme-toggle"
    aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
    title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    onClick={() => setTheme(dark ? 'light' : 'dark')}
  >
    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    <span>{dark ? 'Light' : 'Dark'}</span>
  </button>;
}
