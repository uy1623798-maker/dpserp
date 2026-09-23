import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function preferredTheme(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

export default function ThemeToggle({ scope = 'public' }) {
  const [theme, setTheme] = useState('light');
  const storageKey = `dps-theme-${scope}`;

  useEffect(() => {
    setTheme(preferredTheme(storageKey));
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme]);

  const dark = theme === 'dark';
  return <button
    type="button"
    className={`theme-toggle theme-toggle-${scope}`}
    aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
    title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    onClick={() => setTheme(dark ? 'light' : 'dark')}
  >
    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    <span>{dark ? 'Light' : 'Dark'}</span>
  </button>;
}
