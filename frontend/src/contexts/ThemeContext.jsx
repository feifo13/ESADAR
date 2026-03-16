import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../lib/storage.js';
import { THEME_IDS, THEME_MAP, THEME_OPTIONS, getThemeGroups } from '../constants/themes.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'miami-closet-theme';

const THEME_VARIABLE_KEYS = Array.from(
  new Set(
    THEME_OPTIONS.flatMap((option) => Object.keys(option.vars || {})),
  ),
);

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const normalized = hex.trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function getThemeMode(theme) {
  if (theme?.mode === 'light' || theme?.mode === 'dark') return theme.mode;
  const rgb = hexToRgb(theme?.vars?.['--bg']);
  if (!rgb) return 'light';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.58 ? 'dark' : 'light';
}

function normalizeTheme(rawTheme) {
  if (rawTheme === 'alt') return 'marine';
  if (THEME_IDS.includes(rawTheme)) return rawTheme;
  return 'default';
}

function applyThemeVariables(themeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = THEME_MAP[themeId] || THEME_MAP.default;

  THEME_VARIABLE_KEYS.forEach((key) => {
    root.style.removeProperty(key);
  });

  Object.entries(theme.vars || {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}


export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => normalizeTheme(storage.get(STORAGE_KEY, 'default')));

  function setTheme(nextTheme) {
    setThemeState(normalizeTheme(nextTheme));
  }

  useEffect(() => {
    const themeConfig = THEME_MAP[theme] || THEME_MAP.default;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.colorMode = getThemeMode(themeConfig);
    applyThemeVariables(theme);
    storage.set(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themes: THEME_OPTIONS,
      themeGroups: getThemeGroups(),
      setTheme,
      cycleTheme: () => {
        const currentIndex = THEME_IDS.indexOf(theme);
        const nextIndex = (currentIndex + 1) % THEME_IDS.length;
        setTheme(THEME_IDS[nextIndex]);
      },
      randomTheme: () => {
        const nextIndex = Math.floor(Math.random() * THEME_IDS.length);
        setTheme(THEME_IDS[nextIndex]);
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
