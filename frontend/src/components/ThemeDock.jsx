import { useTheme } from '../contexts/ThemeContext.jsx';

const OPTIONS = [
  { id: 'default', label: 'Default', swatch: ['#06131d', '#00a7b3', '#fc4c02'] },
  { id: 'marine', label: 'Marine', swatch: ['#02101a', '#18c8cf', '#ff6a13'] },
  { id: 'aqua', label: 'Aqua', swatch: ['#03141b', '#00c5d0', '#ff7f2a'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#07111d', '#00a7b3', '#ff7a1f'] },

  { id: 'orange-sand', label: 'Orange Sand', swatch: ['#f7d0b4', '#0c7f92', '#fc4c02'] },
  { id: 'orange-pop', label: 'Orange Pop', swatch: ['#ffb17a', '#005e6a', '#ff5c10'] },
  { id: 'orange-cream', label: 'Orange Cream', swatch: ['#ffe3cf', '#007d8a', '#ef6b1e'] },
  { id: 'orange-court', label: 'Orange Court', swatch: ['#f38b4a', '#08263d', '#ffd0ad'] },
  { id: 'orange-punch', label: 'Orange Punch', swatch: ['#ff7d36', '#0d3852', '#fff0e4'] },

  { id: 'sky-glass', label: 'Sky Glass', swatch: ['#d9f5f8', '#007d8a', '#ff7a1f'] },
  { id: 'sky-mint', label: 'Sky Mint', swatch: ['#bfecef', '#03687a', '#ff8240'] },
  { id: 'sky-board', label: 'Sky Board', swatch: ['#8fdde3', '#0a2a42', '#ff6d21'] },
  { id: 'sky-fade', label: 'Sky Fade', swatch: ['#e8fbfc', '#008e97', '#fc4c02'] },
  { id: 'sky-powder', label: 'Sky Powder', swatch: ['#cfeff5', '#144466', '#ff8b3d'] },

  { id: 'harbor', label: 'Harbor', swatch: ['#f4f8fb', '#12395c', '#ff6a13'] },
  { id: 'whiteout', label: 'Whiteout', swatch: ['#ffffff', '#009cab', '#ff6e1a'] },
  { id: 'storm', label: 'Storm', swatch: ['#d8e1e8', '#27445d', '#ff8240'] },
  { id: 'dolphin-night', label: 'Dolphin Night', swatch: ['#13263a', '#23d3d6', '#ff6f1f'] },
  { id: 'coral-reef', label: 'Coral Reef', swatch: ['#f8efe7', '#00a7b3', '#ff5e1a'] },
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
