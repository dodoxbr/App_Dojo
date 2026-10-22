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

// Cor só para DESENHAR a faixa nas telas (não é regra de graduação). Reconhece o nome da cor no texto que a academia digitou
// ("Azul", "faixa roxa", "Cinza e Preta" → cinza com listra preta); qualquer outro nome fica sem cor própria (`null`).
export type BeltPaint = { base: string; stripe: string | null; label: string };

const PAINT: Record<string, string> = {
  branca: '#F3F5F8', cinza: '#9AA3AE', amarela: '#F2C230', laranja: '#EE8A2B', verde: '#2E9A55',
  azul: '#2B6CD3', roxa: '#7A3FB8', marrom: '#7B4A28', preta: '#15181D', vermelha: '#D6342C',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function beltPaint(code: string | null | undefined): BeltPaint | null {
  if (!code) return null;
  const words = norm(code).split(/[^a-z]+/).filter(Boolean);
  const colors = words.filter((w) => w in PAINT);
  const first = colors[0];
  if (!first) return null;
  const second = colors[1];
  // "Cinza e Preta": base cinza, listra preta. "Cinza e Branca": base cinza, listra branca.
  return { base: PAINT[first]!, stripe: second ? PAINT[second]! : null, label: code };
}

// REFERÊNCIA de idade mínima por faixa (quadro "Idades mínimas e hierarquia" enviado pelo dono do produto, 2026-10-21).
// Só para CONSULTA e para desenhar o quadro: nenhuma regra do sistema usa estes números (cada academia define os seus, US-010).
// `until` = idade máxima da faixa infantil (15); sem `until`, a faixa segue adiante.
export type BeltAgeRow = { belt: string; from: number; until?: number };

export const beltAgeReference: readonly BeltAgeRow[] = [
  { belt: 'Branca', from: 4 },
  { belt: 'Cinza e Branca', from: 4, until: 15 },
  { belt: 'Cinza', from: 4, until: 15 },
  { belt: 'Cinza e Preta', from: 4, until: 15 },
  { belt: 'Amarela e Branca', from: 7, until: 15 },
  { belt: 'Amarela', from: 7, until: 15 },
  { belt: 'Amarela e Preta', from: 7, until: 15 },
  { belt: 'Laranja e Branca', from: 10, until: 15 },
  { belt: 'Laranja', from: 10, until: 15 },
  { belt: 'Laranja e Preta', from: 10, until: 15 },
  { belt: 'Verde e Branca', from: 13, until: 15 },
  { belt: 'Verde', from: 13, until: 15 },
  { belt: 'Verde e Preta', from: 13, until: 15 },
  { belt: 'Azul', from: 16 },
  { belt: 'Roxa', from: 16 },
  { belt: 'Marrom', from: 18 },
  { belt: 'Preta', from: 19 },
  { belt: 'Vermelha e Preta', from: 50 },
  { belt: 'Vermelha e Branca', from: 57 },
  { belt: 'Vermelha', from: 67 },
];
