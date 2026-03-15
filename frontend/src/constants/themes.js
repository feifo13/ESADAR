const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MIAMI = {
  aqua: '#00a7b3',
  orange: '#fc4c02',
  navy: '#002244',
};

const makeDarkTheme = ({ id, label, bg, surface, surfaceSoft, aqua = MIAMI.aqua, orange = MIAMI.orange, navy = MIAMI.navy, text = '#f3f8fa', muted = '#9eb4bc', swatch }) => ({
  id,
  label,
  mode: 'dark',
  swatch: swatch || [bg, aqua, orange],
  vars: {
    bg,
    surface,
    'surface-soft': surfaceSoft,
    text,
    muted,
    border: rgba(aqua, 0.18),
    aqua,
    orange,
    navy,
    'comic-dot': rgba(aqua, 0.26),
    'comic-line': rgba(navy, 0.12),
    'comic-shadow': rgba(navy, 0.28),
    'comic-ink': navy,
  },
});

const makeLightTheme = ({ id, label, bg, surface, surfaceSoft, aqua = MIAMI.aqua, orange = MIAMI.orange, navy = MIAMI.navy, text = '#102b34', muted = '#56737a', swatch }) => ({
  id,
  label,
  mode: 'light',
  swatch: swatch || [bg, aqua, orange],
  vars: {
    bg,
    surface,
    'surface-soft': surfaceSoft,
    text,
    muted,
    border: rgba(navy, 0.14),
    aqua,
    orange,
    navy,
    'comic-dot': rgba(aqua, 0.18),
    'comic-line': rgba(navy, 0.08),
    'comic-shadow': rgba(navy, 0.16),
    'comic-ink': navy,
  },
});

const coreThemes = [
  makeDarkTheme({ id: 'default', label: 'Default', bg: '#06131d', surface: '#081c2a', surfaceSoft: '#0b2131', aqua: '#00a7b3', orange: '#fc4c02', navy: '#002244' }),
  makeDarkTheme({ id: 'marine', label: 'Marine', bg: '#02101a', surface: '#061827', surfaceSoft: '#0b2438', aqua: '#18c8cf', orange: '#ff6a13', navy: '#0f4c81' }),
  makeDarkTheme({ id: 'aqua', label: 'Aqua', bg: '#03141b', surface: '#082029', surfaceSoft: '#0d2b34', aqua: '#00c5d0', orange: '#ff7f2a', navy: '#01314f' }),
  makeDarkTheme({ id: 'sunset', label: 'Sunset', bg: '#07111d', surface: '#0d1b2a', surfaceSoft: '#112436', aqua: '#00a7b3', orange: '#ff7a1f', navy: '#162c4b', muted: '#c9beb2', text: '#fbf7f2', swatch: ['#07111d', '#00a7b3', '#ff7a1f'] }),

  makeLightTheme({ id: 'orange-sand', label: 'Orange Sand', bg: '#f7d0b4', surface: '#fff6f0', surfaceSoft: '#ffe7d8', aqua: '#0c7f92', orange: '#fc4c02', navy: '#143552', text: '#143552', muted: '#5e7286', swatch: ['#f7d0b4', '#0c7f92', '#fc4c02'] }),
  makeLightTheme({ id: 'orange-pop', label: 'Orange Pop', bg: '#ffb17a', surface: '#fff4ec', surfaceSoft: '#ffe0cc', aqua: '#005e6a', orange: '#ff5c10', navy: '#12324b', text: '#12324b', muted: '#5f7386', swatch: ['#ffb17a', '#005e6a', '#ff5c10'] }),
  makeLightTheme({ id: 'orange-cream', label: 'Orange Cream', bg: '#ffe3cf', surface: '#fffaf6', surfaceSoft: '#fff0e4', aqua: '#007d8a', orange: '#ef6b1e', navy: '#15344e', text: '#15344e', muted: '#66798b', swatch: ['#ffe3cf', '#007d8a', '#ef6b1e'] }),
  makeLightTheme({ id: 'orange-court', label: 'Orange Court', bg: '#f38b4a', surface: '#fff4eb', surfaceSoft: '#ffd7bc', aqua: '#0a7b90', orange: '#f38b4a', navy: '#08263d', text: '#08263d', muted: '#5c6f81', swatch: ['#f38b4a', '#08263d', '#ffd0ad'] }),
  makeLightTheme({ id: 'orange-punch', label: 'Orange Punch', bg: '#ff7d36', surface: '#fff3eb', surfaceSoft: '#ffd7c4', aqua: '#0d7287', orange: '#ff7d36', navy: '#0d3852', text: '#0d3852', muted: '#617383', swatch: ['#ff7d36', '#0d3852', '#fff0e4'] }),

  makeLightTheme({ id: 'sky-glass', label: 'Sky Glass', bg: '#d9f5f8', surface: '#ffffff', surfaceSoft: '#edfafd', aqua: '#007d8a', orange: '#ff7a1f', navy: '#12344f', text: '#12344f', muted: '#5e7785', swatch: ['#d9f5f8', '#007d8a', '#ff7a1f'] }),
  makeLightTheme({ id: 'sky-mint', label: 'Sky Mint', bg: '#bfecef', surface: '#fcfeff', surfaceSoft: '#e8fafb', aqua: '#03687a', orange: '#ff8240', navy: '#17374f', text: '#17374f', muted: '#607987', swatch: ['#bfecef', '#03687a', '#ff8240'] }),
  makeLightTheme({ id: 'sky-board', label: 'Sky Board', bg: '#8fdde3', surface: '#f9feff', surfaceSoft: '#dbf4f7', aqua: '#14a4b2', orange: '#ff6d21', navy: '#0a2a42', text: '#0a2a42', muted: '#597180', swatch: ['#8fdde3', '#0a2a42', '#ff6d21'] }),
  makeLightTheme({ id: 'sky-fade', label: 'Sky Fade', bg: '#e8fbfc', surface: '#ffffff', surfaceSoft: '#f2fdfe', aqua: '#008e97', orange: '#fc4c02', navy: '#11344d', text: '#11344d', muted: '#607b89', swatch: ['#e8fbfc', '#008e97', '#fc4c02'] }),
  makeLightTheme({ id: 'sky-powder', label: 'Sky Powder', bg: '#cfeff5', surface: '#fbfeff', surfaceSoft: '#ebf7fb', aqua: '#198da0', orange: '#ff8b3d', navy: '#144466', text: '#144466', muted: '#627a8c', swatch: ['#cfeff5', '#144466', '#ff8b3d'] }),

  makeLightTheme({ id: 'harbor', label: 'Harbor', bg: '#f4f8fb', surface: '#ffffff', surfaceSoft: '#edf3f8', aqua: '#188fab', orange: '#ff6a13', navy: '#12395c', text: '#12395c', muted: '#5d7587', swatch: ['#f4f8fb', '#12395c', '#ff6a13'] }),
  makeLightTheme({ id: 'whiteout', label: 'Whiteout', bg: '#ffffff', surface: '#ffffff', surfaceSoft: '#f5fafb', aqua: '#009cab', orange: '#ff6e1a', navy: '#13324f', text: '#13324f', muted: '#657e8b', swatch: ['#ffffff', '#009cab', '#ff6e1a'] }),
  makeLightTheme({ id: 'storm', label: 'Storm', bg: '#d8e1e8', surface: '#f7f9fb', surfaceSoft: '#e9eef3', aqua: '#4aa9b5', orange: '#ff8240', navy: '#27445d', text: '#27445d', muted: '#617383', swatch: ['#d8e1e8', '#27445d', '#ff8240'] }),
  makeDarkTheme({ id: 'dolphin-night', label: 'Dolphin Night', bg: '#13263a', surface: '#193149', surfaceSoft: '#21405d', aqua: '#23d3d6', orange: '#ff6f1f', navy: '#071726', swatch: ['#13263a', '#23d3d6', '#ff6f1f'] }),
  makeLightTheme({ id: 'coral-reef', label: 'Coral Reef', bg: '#f8efe7', surface: '#fffaf6', surfaceSoft: '#fdf2ea', aqua: '#00a7b3', orange: '#ff5e1a', navy: '#123453', text: '#123453', muted: '#697d8c', swatch: ['#f8efe7', '#00a7b3', '#ff5e1a'] }),
];

const comicWhiteConfigs = [
  ['comic-white-01', 'Comic Tilt White 01', '#ffffff', '#ffffff', '#f6fbfc', '#00a7b3', '#fc4c02', '#002244'],
  ['comic-white-02', 'Comic Tilt White 02', '#fffdfa', '#ffffff', '#fff4ec', '#00b5c0', '#ff6d21', '#002244'],
  ['comic-white-03', 'Comic Tilt White 03', '#fbffff', '#ffffff', '#eefbfd', '#00c0cb', '#fc4c02', '#062f55'],
  ['comic-white-04', 'Comic Tilt White 04', '#fffbf7', '#ffffff', '#fff0e6', '#00a7b3', '#ff7c33', '#143552'],
  ['comic-white-05', 'Comic Tilt White 05', '#fdfefe', '#ffffff', '#eff7fa', '#17b7c0', '#ff6a13', '#083658'],
  ['comic-white-06', 'Comic Tilt White 06', '#fffefc', '#ffffff', '#f7f4ef', '#00a7b3', '#f66316', '#0a2744'],
  ['comic-white-07', 'Comic Tilt White 07', '#fbfcff', '#ffffff', '#edf3fb', '#1abdc5', '#ff6d21', '#163b64'],
  ['comic-white-08', 'Comic Tilt White 08', '#fffdfa', '#ffffff', '#f6efe8', '#00a7b3', '#fc4c02', '#1b3d5f'],
  ['comic-white-09', 'Comic Tilt White 09', '#fcfffe', '#ffffff', '#edf9f8', '#00b7c2', '#ff7f2a', '#002244'],
  ['comic-white-10', 'Comic Tilt White 10', '#fffaf6', '#ffffff', '#fff1eb', '#08acb8', '#ff6a13', '#0b3152'],
  ['comic-white-11', 'Comic Tilt White 11', '#ffffff', '#ffffff', '#f3f7fb', '#21bbc7', '#fc4c02', '#123b68'],
  ['comic-white-12', 'Comic Tilt White 12', '#fffdfb', '#ffffff', '#f4f5f7', '#00a7b3', '#ff8240', '#08263d'],
  ['comic-white-13', 'Comic Tilt White 13', '#fbfffd', '#ffffff', '#eefaf7', '#0eb8c3', '#f85e18', '#083451'],
  ['comic-white-14', 'Comic Tilt White 14', '#fffbf8', '#ffffff', '#fff0ea', '#00a7b3', '#ff7030', '#123250'],
  ['comic-white-15', 'Comic Tilt White 15', '#fcfeff', '#ffffff', '#eff7fc', '#18c6cf', '#ff6d21', '#002244'],
];

const comicDarkConfigs = [
  ['comic-dark-01', 'Comic Tilt Dark 01', '#07131c', '#0d1c28', '#132737', '#00a7b3', '#fc4c02', '#001a33'],
  ['comic-dark-02', 'Comic Tilt Dark 02', '#081521', '#0d2030', '#133047', '#18c8cf', '#ff6a13', '#001f3f'],
  ['comic-dark-03', 'Comic Tilt Dark 03', '#09111a', '#122331', '#183042', '#00b8c4', '#ff7f2a', '#002244'],
  ['comic-dark-04', 'Comic Tilt Dark 04', '#07111d', '#0f1f2e', '#16314a', '#00a7b3', '#ff7030', '#12395c'],
  ['comic-dark-05', 'Comic Tilt Dark 05', '#0a1520', '#102232', '#17354f', '#1bc0cb', '#ff6d21', '#002244'],
  ['comic-dark-06', 'Comic Tilt Dark 06', '#071018', '#0d1c2a', '#153045', '#00a7b3', '#f85e18', '#0a2744'],
  ['comic-dark-07', 'Comic Tilt Dark 07', '#07131d', '#102031', '#18334e', '#23d3d6', '#ff6f1f', '#071726'],
  ['comic-dark-08', 'Comic Tilt Dark 08', '#09131b', '#122331', '#162a3d', '#12b8c2', '#ff8240', '#002244'],
  ['comic-dark-09', 'Comic Tilt Dark 09', '#07141f', '#0f2233', '#15354d', '#00b5c0', '#ff6a13', '#163b64'],
  ['comic-dark-10', 'Comic Tilt Dark 10', '#081118', '#101f2c', '#162c3f', '#00a7b3', '#fc4c02', '#123250'],
  ['comic-dark-11', 'Comic Tilt Dark 11', '#09141d', '#102330', '#173244', '#1ec4cc', '#ff7a1f', '#08263d'],
  ['comic-dark-12', 'Comic Tilt Dark 12', '#07121a', '#0d1f2c', '#143247', '#00b9c5', '#ff7030', '#083451'],
  ['comic-dark-13', 'Comic Tilt Dark 13', '#0a1521', '#112433', '#17384f', '#18c6cf', '#ff6d21', '#0f3150'],
  ['comic-dark-14', 'Comic Tilt Dark 14', '#08131d', '#0f2232', '#163148', '#00a7b3', '#ff8240', '#002244'],
  ['comic-dark-15', 'Comic Tilt Dark 15', '#07111a', '#10212e', '#183249', '#20c7d0', '#ff6a13', '#0b3152'],
];

const comicWhiteThemes = comicWhiteConfigs.map(([id, label, bg, surface, surfaceSoft, aqua, orange, navy]) => makeLightTheme({
  id,
  label,
  bg,
  surface,
  surfaceSoft,
  aqua,
  orange,
  navy,
  text: navy,
  muted: rgba(navy, 0.72),
  swatch: ['#ffffff', aqua, orange],
}));

const comicDarkThemes = comicDarkConfigs.map(([id, label, bg, surface, surfaceSoft, aqua, orange, navy]) => makeDarkTheme({
  id,
  label,
  bg,
  surface,
  surfaceSoft,
  aqua,
  orange,
  navy,
  text: '#f4f8fb',
  muted: rgba('#d7e7ef', 0.72),
  swatch: [bg, aqua, orange],
}));

export const THEME_DEFINITIONS = [
  ...coreThemes,
  ...comicWhiteThemes,
  ...comicDarkThemes,
];

export const THEME_IDS = THEME_DEFINITIONS.map((theme) => theme.id);
export const THEME_MAP = Object.fromEntries(THEME_DEFINITIONS.map((theme) => [theme.id, theme]));
