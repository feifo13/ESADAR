import { createContext, useContext, useEffect, useMemo } from 'react';

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

const FIXED_THEME = {
  id: FIXED_THEME_ID,
  label: 'Sharp Lab Light 01',
  section: 'Sharp Lab',
  mode: 'light',
  swatch: ['#ffffff', '#00a7b3', '#fc4c02'],
  vars: {
    '--bg': '#ffffff',
    '--surface': '#ffffff',
    '--surface-soft': '#eef7f8',
    '--text': '#102b34',
    '--muted': '#667b82',
    '--border': 'rgba(16, 43, 52, 0.14)',
    '--aqua': '#00a7b3',
    '--orange': '#fc4c02',
    '--navy': '#002244',
  },
};

function applyFontVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--font-body', FIXED_FONT.body);
  root.style.setProperty('--font-display', FIXED_FONT.display);
}

function applyThemeVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  Object.entries(FIXED_THEME.vars).forEach(([key, value]) => {
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
    document.documentElement.dataset.theme = FIXED_THEME_ID;
    document.documentElement.dataset.colorMode = FIXED_THEME.mode;
    applyThemeVariables();
    applyFontVariables();
    clearThemeStorage();
  }, []);

  const value = useMemo(
    () => ({
      theme: FIXED_THEME_ID,
      themes: [FIXED_THEME],
      themeGroups: [{ section: FIXED_THEME.section, items: [FIXED_THEME] }],
      setTheme: () => undefined,
      font: FIXED_FONT_ID,
      fonts: [FIXED_FONT],
      setFont: () => undefined,
      cycleTheme: () => undefined,
      randomTheme: () => undefined,
    }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
