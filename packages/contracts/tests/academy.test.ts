import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  createAcademySchema,
  formatCnpj,
  isValidCnpj,
  instructorPermissions,
  slugSchema,
  themeSchema,
} from '../src/academy.ts';

// Same reference values asserted in supabase/tests/database/academy_creation.test.sql.
test('contrast ratio matches WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(contrastRatio('#FFFFFF', '#000000'), contrastRatio('#000000', '#FFFFFF'));
});

test('theme requires valid colors and enough contrast', () => {
  const ok = { name: 'Academia Teste', themePrimary: '#163A64', themeSecondary: '#FFFFFF' };
  assert.equal(themeSchema.safeParse(ok).success, true);
  assert.equal(themeSchema.safeParse({ ...ok, themePrimary: '#777777' }).success, false);
  assert.equal(themeSchema.safeParse({ ...ok, themePrimary: 'azul' }).success, false);
  assert.equal(themeSchema.safeParse({ ...ok, name: 'x' }).success, false);
});

test('slug is normalized and restricted', () => {
  assert.equal(slugSchema.parse('  Academia-Teste '), 'academia-teste');
  assert.equal(slugSchema.safeParse('com espaço').success, false);
  assert.equal(slugSchema.safeParse('-inicio').success, false);
});

test('create academy needs an idempotency key, the company name and a valid CNPJ', () => {
  const base = { name: 'Academia Teste', slug: 'academia-teste', legalName: 'Academia Teste Ltda (teste)', cnpj: '11.222.333/0001-81' };
  assert.equal(createAcademySchema.safeParse(base).success, false);
  const ok = createAcademySchema.parse({ ...base, idempotencyKey: crypto.randomUUID() });
  assert.equal(ok.cnpj, '11222333000181', 'o CNPJ vira só dígitos');
  assert.equal(createAcademySchema.safeParse({ ...base, cnpj: '11.222.333/0001-80', idempotencyKey: crypto.randomUUID() }).success, false);
  assert.equal(createAcademySchema.safeParse({ ...base, legalName: ' ', idempotencyKey: crypto.randomUUID() }).success, false);
});

test('CNPJ check digits', () => {
  assert.equal(isValidCnpj('11222333000181'), true);
  assert.equal(isValidCnpj('11222333000182'), false);
  assert.equal(isValidCnpj('11111111111111'), false);
  assert.equal(isValidCnpj('123'), false);
  assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
});

test('diary is never an instructor permission', () => {
  assert.equal((instructorPermissions as readonly string[]).some((p) => p.includes('diary')), false);
});
