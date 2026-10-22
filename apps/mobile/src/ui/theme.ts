// Tokens do app (tema escuro, mesmos valores do painel web: apps/admin/styles/tokens.css, ADR-028). Só os nomes semânticos são usados nas telas.
export const colors = {
  primary: '#4CC9B8',
  primaryStrong: '#070E17',
  primaryContrast: '#04201C',
  accent: '#4CC9B8',
  accentStrong: '#4CC9B8',
  accentBright: '#4CC9B8',
  onAccentBright: '#04201C',
  bg: '#08121C',
  surface: '#101C2A',
  text: '#E8EEF3',
  textMuted: '#9FB0C0',
  border: '#223245',
  borderStrong: '#3D5066',
  danger: '#FF6B7A',
  dangerSurface: '#34171D',
  success: '#46D18A',
  successSurface: '#10301F',
  info: '#6AAEF5',
  infoSurface: '#13294A',
  accentSurface: '#0F3A36',
  // textos sobre as superfícies de estado (tema escuro)
  dangerText: '#FFC9CF',
  successText: '#BDF3D6',
  infoText: '#C8E0FB',
  accentText: '#8FE8DC',
  // brilho do anel e dos destaques
  glow: 'rgba(76,201,184,0.34)',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const radius = { card: 14, control: 10, pill: 999 } as const;

export const font = { xs: 13, sm: 14, md: 16, lg: 20, xl: 26, xxl: 36 } as const;

export const controlHeight = 48;
