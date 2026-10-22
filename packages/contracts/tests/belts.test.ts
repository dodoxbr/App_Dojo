import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adultBeltSuggestions, BELT_MAX_LENGTH, beltSuggestions, youthBeltSuggestions } from '../src/belts.ts';

test('belt suggestions are only names: unique, non-empty and within the database limit', () => {
  assert.equal(beltSuggestions.length, adultBeltSuggestions.length + youthBeltSuggestions.length);
  assert.equal(new Set(beltSuggestions.map((b) => b.toLowerCase())).size, beltSuggestions.length);
  for (const b of beltSuggestions) {
    assert(b.trim().length > 0 && b.length <= BELT_MAX_LENGTH, b);
  }
});

test('suggestions carry no numbers (ages, times and degrees are never imposed)', () => {
  for (const b of beltSuggestions) assert.equal(/\d/.test(b), false, b);
});

test('cor da faixa só para desenhar: reconhece o nome da cor e ignora o resto', async () => {
  const { beltPaint } = await import('../src/belts.ts');
  assert.equal(beltPaint('Azul')?.base, '#2B6CD3');
  assert.equal(beltPaint('faixa roxa')?.base, '#7A3FB8');
  assert.equal(beltPaint('  PRETA ')?.stripe, null);
  const youth = beltPaint('Cinza e Preta');
  assert.equal(youth?.base, '#9AA3AE');
  assert.equal(youth?.stripe, '#15181D');
  assert.equal(beltPaint('Faixa Teste A'), null, 'nome sem cor conhecida não ganha cor');
  assert.equal(beltPaint(null), null);
});
