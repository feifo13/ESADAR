const FIXED_THEME = {
  id: 'sharp-lab-light-01',
  label: 'Sharp Lab Light 01',
  section: 'Sharp Lab',
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

export const THEME_GROUPS = [{ section: FIXED_THEME.section, items: [FIXED_THEME] }];
export const THEME_PRESETS = [FIXED_THEME];
export const DEFAULT_THEME = FIXED_THEME.id;
