import { createContext, useContext, useEffect, useMemo } from 'react';
import { THEME_MAP, THEME_OPTIONS } from '../constants/themes.js';

const ThemeContext = createContext(null);

const FIXED_THEME_ID = 'sharp-lab-light-01';
const FIXED_FONT_ID = 'brand';
const STORAGE_KEYS_TO_CLEAR = [
  'miami-closet-theme',
  'esadar-theme-font',
  'esadar-theme-dock-hidden',
];

const BRAND_FONT_BODY = "'Neo Grotesk', system-ui, sans-serif";
const BRAND_FONT_DISPLAY = "'Neo Grotesk', system-ui, sans-serif";

const FIXED_FONT = {
  id: FIXED_FONT_ID,
  label: 'Neo Grotesk',
  body: BRAND_FONT_BODY,
  display: BRAND_FONT_DISPLAY,
};

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

function applyFontVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--font-body', FIXED_FONT.body);
  root.style.setProperty('--font-display', FIXED_FONT.display);
}

function applyThemeVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = THEME_MAP[FIXED_THEME_ID];

  THEME_VARIABLE_KEYS.forEach((key) => {
    root.style.removeProperty(key);
  });

  Object.entries(theme?.vars || {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function clearThemeStorage() {
  if (typeof window === 'undefined') return;
  STORAGE_KEYS_TO_CLEAR.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // localStorage can be unavailable in private browsing modes.
    }
  });
}

export function ThemeProvider({ children }) {
  useEffect(() => {
    const themeConfig = THEME_MAP[FIXED_THEME_ID];
    document.documentElement.dataset.theme = FIXED_THEME_ID;
    document.documentElement.dataset.colorMode = getThemeMode(themeConfig);
    applyThemeVariables();
    applyFontVariables();
    clearThemeStorage();
  }, []);

  const value = useMemo(() => {
    const fixedTheme = THEME_MAP[FIXED_THEME_ID];
    return {
      theme: FIXED_THEME_ID,
      themes: fixedTheme ? [fixedTheme] : [],
      themeGroups: fixedTheme
        ? [{ section: fixedTheme.section || 'Tema', items: [fixedTheme] }]
        : [],
      setTheme: () => undefined,
      font: FIXED_FONT_ID,
      fonts: [FIXED_FONT],
      setFont: () => undefined,
      cycleTheme: () => undefined,
      randomTheme: () => undefined,
    };
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
