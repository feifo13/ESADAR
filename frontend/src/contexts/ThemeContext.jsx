import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../lib/storage.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => storage.get('miami-closet-theme', 'default'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.set('miami-closet-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === 'default' ? 'alt' : 'default')),
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
