import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthDateSchema, displayNameSchema, isAdultOn, signInSchema, signUpSchema } from '../src/auth.ts';

test('display name is trimmed and bounded 2..120', () => {
  assert.equal(displayNameSchema.parse('  Aluno Teste  '), 'Aluno Teste');
  assert.equal(displayNameSchema.safeParse('x').success, false);
  assert.equal(displayNameSchema.safeParse(' x ').success, false);
  assert.equal(displayNameSchema.safeParse('x'.repeat(121)).success, false);
  assert.equal(displayNameSchema.safeParse('x'.repeat(120)).success, true);
});

test('sign in normalizes e-mail and requires a password of 8+ chars', () => {
  assert.equal(signInSchema.parse({ email: ' A@Example.TEST ', password: '12345678' }).email, 'a@example.test');
  assert.equal(signInSchema.safeParse({ email: 'nao-e-email', password: '12345678' }).success, false);
  assert.equal(signInSchema.safeParse({ email: 'a@example.test', password: '1234567' }).success, false);
});

test('sign up requires a valid display name and a birth date', () => {
  const base = { email: 'a@example.test', password: '12345678', birthDate: '1990-01-01', acceptTerms: 'on' };
  assert.equal(signUpSchema.safeParse({ ...base, displayName: 'Aluno Teste' }).success, true);
  assert.equal(signUpSchema.safeParse({ ...base, displayName: '' }).success, false);
  assert.equal(signUpSchema.safeParse({ email: base.email, password: base.password, displayName: 'Aluno Teste' }).success, false);
  assert.equal(signUpSchema.safeParse({ ...base, displayName: 'Aluno Teste', acceptTerms: undefined }).success, false, 'os termos são obrigatórios');
  assert.equal(signUpSchema.safeParse({ ...base, displayName: 'Aluno Teste', acceptTerms: 'off' }).success, false);
});

test('birth date must be a real, past calendar day', () => {
  assert.equal(birthDateSchema.safeParse('1990-02-28').success, true);
  assert.equal(birthDateSchema.safeParse('1990-02-30').success, false);
  assert.equal(birthDateSchema.safeParse('1899-12-31').success, false);
  assert.equal(birthDateSchema.safeParse('2999-01-01').success, false);
  assert.equal(birthDateSchema.safeParse('01/01/1990').success, false);
});

test('adult means 18 or more on the given day (the day of the 18th birthday already counts)', () => {
  const today = new Date('2026-10-20T12:00:00Z');
  assert.equal(isAdultOn('2008-10-20', today), true);
  assert.equal(isAdultOn('2008-10-21', today), false);
  assert.equal(isAdultOn('2008-10-19', today), true);
  assert.equal(isAdultOn('2017-01-01', today), false);
  assert.equal(isAdultOn('1990-01-01', today), true);
});
