import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliasSchema, createTechniqueSchema, techniqueInputSchema, techniqueSearchSchema } from '../src/technique.ts';

test('technique input is trimmed and bounded', () => {
  const ok = techniqueInputSchema.parse({ name: '  Raspagem Teste ', category: 'Raspagens', level: '', description: '  ' });
  assert.equal(ok.name, 'Raspagem Teste');
  assert.equal(ok.level, undefined);
  assert.equal(ok.description, undefined);
  assert.equal(techniqueInputSchema.safeParse({ name: 'x', category: 'Raspagens' }).success, false);
  assert.equal(techniqueInputSchema.safeParse({ name: 'Raspagem', category: 'R' }).success, false);
  assert.equal(techniqueInputSchema.safeParse({ name: 'Raspagem', category: 'Raspagens', description: 'a'.repeat(4001) }).success, false);
});

test('create technique: academy is optional (global) but must be a uuid when given', () => {
  const base = { name: 'Raspagem Teste', category: 'Raspagens', idempotencyKey: crypto.randomUUID() };
  assert.equal(createTechniqueSchema.safeParse(base).success, true);
  assert.equal(createTechniqueSchema.parse({ ...base, academyId: '' }).academyId, undefined);
  assert.equal(createTechniqueSchema.safeParse({ ...base, academyId: crypto.randomUUID() }).success, true);
  assert.equal(createTechniqueSchema.safeParse({ ...base, academyId: 'nao-uuid' }).success, false);
  assert.equal(createTechniqueSchema.safeParse({ name: 'Raspagem', category: 'Raspagens' }).success, false);
});

test('alias length', () => {
  assert.equal(aliasSchema.safeParse(' x ').success, false);
  assert.equal(aliasSchema.parse(' Sinônimo ').length, 8);
});

test('search params fall back to safe defaults instead of failing', () => {
  const empty = techniqueSearchSchema.parse({});
  assert.equal(empty.q, undefined);
  assert.equal(empty.category, undefined);
  assert.equal(empty.page, 1);
  assert.equal(techniqueSearchSchema.parse({ page: '3' }).page, 3);
  assert.equal(techniqueSearchSchema.parse({ page: '-5' }).page, 1);
  assert.equal(techniqueSearchSchema.parse({ page: 'abc' }).page, 1);
  assert.equal(techniqueSearchSchema.parse({ q: 'x'.repeat(200) }).q, undefined);
});
