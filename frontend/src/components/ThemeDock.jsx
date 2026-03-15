import { useTheme } from '../contexts/ThemeContext.jsx';
import { THEME_DOCK_OPTIONS } from '../constants/themeOptions.js';

const THEME_GROUPS = [
  {
    id: 'base',
    label: 'Base',
    description: 'Paletas generales',
    options: THEME_DOCK_OPTIONS.filter((option) => !option.id.startsWith('comic-sharp-')),
  },
  {
    id: 'comic-sharp-light',
    label: 'Comic Sharp Light',
    description: 'Variantes claras',
    options: THEME_DOCK_OPTIONS.filter((option) => option.id.startsWith('comic-sharp-light-')),
  },
  {
    id: 'comic-sharp-dark',
    label: 'Comic Sharp Dark',
    description: 'Variantes oscuras',
    options: THEME_DOCK_OPTIONS.filter((option) => option.id.startsWith('comic-sharp-dark-')),
  },
].filter((group) => group.options.length > 0);

export default function ThemeDock() {
  const { theme, setTheme } = useTheme();

  return (
    <aside className="theme-dock" aria-label="Selector de paleta">
      <div className="theme-dock-label">Paletas</div>
      <div className="theme-dock-groups">
        {THEME_GROUPS.map((group) => (
          <section key={group.id} className="theme-dock-group" aria-label={group.label}>
            <div className="theme-dock-group-head">
              <div>
                <p className="theme-dock-group-title">{group.label}</p>
                <p className="theme-dock-group-description">{group.description}</p>
              </div>
              <span className="theme-dock-group-count">{group.options.length}</span>
            </div>

            <div className="theme-dock-buttons">
              {group.options.map((option) => (
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
          </section>
        ))}
      </div>
    </aside>
  );
}
