import { useMemo, useState } from 'react';
import { storage } from '../lib/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const DOCK_STORAGE_KEY = 'esadar-theme-dock-hidden';

export default function ThemeDock() {
  const { theme, setTheme, themeGroups, randomTheme, font, fonts, setFont } = useTheme();
  const [hidden, setHidden] = useState(() => storage.get(DOCK_STORAGE_KEY, false));
  const groups = useMemo(() => themeGroups || [], [themeGroups]);

  function toggleHidden() {
    const nextValue = !hidden;
    setHidden(nextValue);
    storage.set(DOCK_STORAGE_KEY, nextValue);
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="theme-dock-toggle"
        onClick={toggleHidden}
        aria-label="Mostrar temas"
      >
        Temas
      </button>
    );
  }

  return (
    <aside className="theme-dock" aria-label="Selector de temas">
      <div className="theme-dock-head">
        <div>
          <div className="theme-dock-label">Temas</div>
          <p className="theme-dock-copy">Base + Comic Sharp + Laboratorio Sharp</p>
        </div>
        <div className="theme-dock-actions">
          <button type="button" className="theme-dock-mini-button" onClick={randomTheme}>
            Aleatorio
          </button>
          <button type="button" className="theme-dock-mini-button" onClick={toggleHidden}>
            Ocultar
          </button>
        </div>
      </div>

      <div className="theme-dock-groups">

        <section className="theme-dock-group">
          <div className="theme-dock-group-head">
            <strong>Tipografía</strong>
            <span>{fonts.length}</span>
          </div>
          <div className="theme-font-grid">
            {fonts.map((option) => (
              <button
                key={option.id}
                type="button"
                className={font === option.id ? 'theme-font-swatch active' : 'theme-font-swatch'}
                onClick={() => setFont(option.id)}
                title={option.label}
                aria-label={option.label}
              >
                <span className="theme-font-swatch__name">{option.label}</span>
                <span className="theme-font-swatch__sample" style={{ fontFamily: option.display }}>Aa</span>
              </button>
            ))}
          </div>
        </section>
        {groups.map((group) => (
          <section key={group.section} className="theme-dock-group">
            <div className="theme-dock-group-head">
              <strong>{group.section}</strong>
              <span>{group.items.length}</span>
            </div>
            <div className="theme-dock-buttons">
              {group.items.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={theme === option.id ? 'theme-swatch active' : 'theme-swatch'}
                  onClick={() => setTheme(option.id)}
                  title={option.label}
                  aria-label={option.label}
                >
                  {option.swatch.map((color) => (
                    <span key={`${option.id}-${color}`} style={{ background: color }} />
                  ))}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
