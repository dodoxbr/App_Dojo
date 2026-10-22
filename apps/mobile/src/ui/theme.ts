// Tokens do app (mesmos valores do painel web: apps/admin/styles/tokens.css). Só os nomes semânticos são usados nas telas.
export const colors = {
  primary: '#14243A',
  primaryStrong: '#070E17',
  primaryContrast: '#FFFFFF',
  accent: '#2FA898',
  accentStrong: '#1F7F73',
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  text: '#0E1A27',
  textMuted: '#4A5A69',
  border: '#DCE2E8',
  borderStrong: '#8A97A8',
  danger: '#C43B47',
  dangerSurface: '#FDECEE',
  success: '#1B7A47',
  successSurface: '#E8F6EE',
  info: '#1D5A9E',
  infoSurface: '#EAF2FC',
  accentSurface: '#DCF3F0',
  accentBright: '#4CC9B8',
  onAccentBright: '#04201C',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const radius = { card: 14, control: 10, pill: 999 } as const;

export const font = { xs: 13, sm: 14, md: 16, lg: 20, xl: 26, xxl: 36 } as const;

export const controlHeight = 48;
