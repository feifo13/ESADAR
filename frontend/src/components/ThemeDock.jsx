import { useTheme } from '../contexts/ThemeContext.jsx';

const OPTIONS = [
  { id: 'default', label: 'Default', swatch: ['#002244', '#008e97', '#fc4c02'] },
  { id: 'marine', label: 'Marine', swatch: ['#02121f', '#0f4c81', '#2ad0d8'] },
  { id: 'aqua', label: 'Aqua', swatch: ['#041b23', '#00a7b3', '#6df3f5'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#0a1626', '#ff6b1a', '#00b7c3'] },
];

export default function ThemeDock() {
  const { theme, setTheme } = useTheme();

  return (
    <aside className="theme-dock" aria-label="Selector de paleta">
      <div className="theme-dock-label">Paletas</div>
      <div className="theme-dock-buttons">
        {OPTIONS.map((option) => (
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
