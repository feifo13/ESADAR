import { useTheme } from '../contexts/ThemeContext.jsx';
import { THEME_DOCK_OPTIONS } from '../constants/themeOptions.js';

export default function ThemeDock() {
  const { theme, setTheme } = useTheme();

  return (
    <aside className="theme-dock" aria-label="Selector de paleta">
      <div className="theme-dock-label">Paletas</div>
      <div className="theme-dock-buttons">
        {THEME_DOCK_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={theme === option.id ? 'theme-swatch active' : 'theme-swatch'}
            onClick={() => setTheme(option.id)}
            title={option.label}
            aria-label={option.label}
          >
            {option.swatch.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </button>
        ))}
      </div>
    </aside>
  );
}
