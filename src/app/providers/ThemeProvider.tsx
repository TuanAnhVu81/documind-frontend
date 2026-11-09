import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme, type ThemePreference } from './theme-context';

const THEME_KEY = 'documind-theme';
function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
function initialPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* storage is optional */
  }
  return 'system';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setValue] = useState<ThemePreference>(initialPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme = preference === 'system' ? system : preference;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystem(media.matches ? 'dark' : 'light');
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (
        event.key === THEME_KEY &&
        (event.newValue === null ||
          event.newValue === 'light' ||
          event.newValue === 'dark' ||
          event.newValue === 'system')
      )
        setValue(event.newValue ?? 'system');
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  function setPreference(value: ThemePreference) {
    setValue(value);
    try {
      window.localStorage.setItem(THEME_KEY, value);
    } catch {
      /* preference remains in memory */
    }
  }
  function toggleTheme() {
    setPreference(theme === 'light' ? 'dark' : 'light');
  }
  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
