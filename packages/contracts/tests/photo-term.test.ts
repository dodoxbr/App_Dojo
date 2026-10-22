import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTerms, isValidSignature, PHOTO_TERM_VERSION, photoTerm } from '../src/terms.ts';
import { requestDependentSchema } from '../src/guardians.ts';

test('signature: needs a first and a last name', () => {
  assert.equal(isValidSignature('Maria da Silva'), true);
  assert.equal(isValidSignature('  Maria Silva  '), true);
  assert.equal(isValidSignature('Maria'), false);
  assert.equal(isValidSignature(''), false);
  assert.equal(isValidSignature(null), false);
  assert.equal(isValidSignature('a b'), false);
});

test('photo term: a draft with the key sections, versioned', () => {
  assert.ok(PHOTO_TERM_VERSION.startsWith('rascunho'));
  const ids = photoTerm.map((s) => s.id);
  for (const id of ['objeto', 'onde', 'moderacao', 'revogacao', 'assinatura']) assert.ok(ids.includes(id), id);
  const text = fillTerms(photoTerm, { empresa: 'Academia Teste' }).flatMap((s) => s.paragraphs).join(' ');
  assert.ok(text.includes('Academia Teste'));
  assert.ok(!text.includes('{{'));
});

test('dependent request carries an optional signature', () => {
  const base = { minorId: crypto.randomUUID(), academyId: crypto.randomUUID(), photos: true };
  assert.equal(requestDependentSchema.safeParse({ ...base, signature: 'Maria da Silva' }).success, true);
  assert.equal(requestDependentSchema.safeParse(base).success, true);
});
