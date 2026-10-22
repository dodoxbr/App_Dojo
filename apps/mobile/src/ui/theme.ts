// Tokens do app (mesmos valores do painel web: apps/admin/styles/tokens.css). Só os nomes semânticos são usados nas telas.
export const colors = {
  primary: '#183B63',
  primaryStrong: '#102840',
  primaryContrast: '#FFFFFF',
  accent: '#0E9488',
  accentStrong: '#0B756B',
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#142235',
  textMuted: '#5A6A80',
  border: '#DFE5ED',
  borderStrong: '#8A97A8',
  danger: '#C43B47',
  dangerSurface: '#FDECEE',
  success: '#1B7A47',
  successSurface: '#E8F6EE',
  info: '#1D5A9E',
  infoSurface: '#EAF2FC',
  accentSurface: '#DCF3F0',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const radius = { card: 16, control: 10, pill: 999 } as const;

export const font = { xs: 13, sm: 14, md: 16, lg: 20, xl: 26, xxl: 36 } as const;

export const controlHeight = 48;
