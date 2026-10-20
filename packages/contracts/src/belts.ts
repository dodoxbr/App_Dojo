// Name SUGGESTIONS for belts, only to speed up typing (docs/14). They are NOT rules: every academy defines its own
// belts, degrees, ages and times (US-010), and any other text is accepted.

export const adultBeltSuggestions = ['Branca', 'Azul', 'Roxa', 'Marrom', 'Preta'] as const;

export const youthBeltSuggestions = [
  'Cinza e Branca',
  'Cinza',
  'Cinza e Preta',
  'Amarela e Branca',
  'Amarela',
  'Amarela e Preta',
  'Laranja e Branca',
  'Laranja',
  'Laranja e Preta',
  'Verde e Branca',
  'Verde',
  'Verde e Preta',
] as const;

export const beltSuggestions: readonly string[] = [...adultBeltSuggestions, ...youthBeltSuggestions];

// Same limits the database enforces on belt labels and degrees.
export const BELT_MAX_LENGTH = 40;
export const DEGREE_RANGE = { min: 0, max: 20 } as const;
