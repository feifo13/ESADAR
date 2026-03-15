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

  { id: 'midnight-pool', label: 'Midnight Pool', swatch: ['#09121f', '#00c0cf', '#ff7f2a'] },
  { id: 'teal-gold', label: 'Teal Gold', swatch: ['#0c1b24', '#16b6c7', '#f6a623'] },
  { id: 'peach-club', label: 'Peach Club', swatch: ['#24171d', '#ffb38a', '#00b9c7'] },
  { id: 'blue-hour', label: 'Blue Hour', swatch: ['#10182c', '#3ab7ff', '#ff7b54'] },
  { id: 'electric-sea', label: 'Electric Sea', swatch: ['#07141a', '#00d4e0', '#ff8f3d'] },
  { id: 'tangerine-night', label: 'Tangerine Night', swatch: ['#171012', '#ff7a2f', '#3ccbd5'] },
  { id: 'retro-coast', label: 'Retro Coast', swatch: ['#0f2330', '#6fe7f2', '#ff9861'] },
  { id: 'steel-aqua', label: 'Steel Aqua', swatch: ['#1b2832', '#4cc9d4', '#ff8a48'] },
  { id: 'neon-harbor', label: 'Neon Harbor', swatch: ['#081017', '#17e6dc', '#ff6c37'] },
  { id: 'warm-current', label: 'Warm Current', swatch: ['#18161d', '#ff9864', '#27c6cf'] },

  { id: 'white-breeze', label: 'White Breeze', swatch: ['#ffffff', '#00a9b8', '#ff7c2a'] },
  { id: 'white-lagoon', label: 'White Lagoon', swatch: ['#fbffff', '#19bfd0', '#ff914d'] },
  { id: 'white-coral', label: 'White Coral', swatch: ['#fffaf7', '#009faf', '#ff6b4a'] },
  { id: 'white-ice', label: 'White Ice', swatch: ['#f7fcff', '#56c4dd', '#ff8f5a'] },
  { id: 'white-sport', label: 'White Sport', swatch: ['#ffffff', '#0d4f8b', '#ff6e1a'] },
  { id: 'white-wave', label: 'White Wave', swatch: ['#fbfdff', '#007f97', '#ff8440'] },
  { id: 'white-drift', label: 'White Drift', swatch: ['#fdfcf9', '#26b2bf', '#ff9d5c'] },
  { id: 'white-flare', label: 'White Flare', swatch: ['#ffffff', '#00a7b3', '#fc4c02'] },
  { id: 'white-boardwalk', label: 'White Boardwalk', swatch: ['#fffefb', '#12496f', '#ff7a1f'] },
  { id: 'white-atlantic', label: 'White Atlantic', swatch: ['#f8fbff', '#008da3', '#ff7340'] },
  { id: 'comic-pop', label: 'Comic Pop', swatch: ['#ffe55c', '#12bbff', '#ff5b3a'] },
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
