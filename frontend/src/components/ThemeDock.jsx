import { useMemo, useState } from 'react';
import { storage } from '../lib/storage.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const DOCK_STORAGE_KEY = 'esadar-theme-dock-hidden';

export default function ThemeDock() {
  const { theme, setTheme, themeGroups, randomTheme } = useTheme();
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
        aria-label="Mostrar themes"
      >
        Themes
      </button>
    );
  }

  return (
    <aside className="theme-dock" aria-label="Selector de paleta">
      <div className="theme-dock-head">
        <div>
          <div className="theme-dock-label">Themes</div>
          <p className="theme-dock-copy">Base + Comic Sharp + Sharp Lab</p>
        </div>
        <div className="theme-dock-actions">
          <button type="button" className="theme-dock-mini-button" onClick={randomTheme}>
            Random
          </button>
          <button type="button" className="theme-dock-mini-button" onClick={toggleHidden}>
            Ocultar
          </button>
        </div>
      </div>

      <div className="theme-dock-groups">
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
