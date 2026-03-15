import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../lib/storage.js';

const ThemeContext = createContext(null);
export const THEME_OPTIONS = ['default', 'marine', 'aqua', 'sunset'];

function normalizeTheme(rawTheme) {
  if (rawTheme === 'alt') return 'marine';
  if (THEME_OPTIONS.includes(rawTheme)) return rawTheme;
  return 'default';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => normalizeTheme(storage.get('miami-closet-theme', 'default')));

  function setTheme(nextTheme) {
    setThemeState(normalizeTheme(nextTheme));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.set('miami-closet-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themes: THEME_OPTIONS,
      setTheme,
      cycleTheme: () => {
        const currentIndex = THEME_OPTIONS.indexOf(theme);
        const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
        setTheme(THEME_OPTIONS[nextIndex]);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
