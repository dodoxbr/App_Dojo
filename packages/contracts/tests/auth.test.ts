import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayNameSchema, signInSchema, signUpSchema } from '../src/auth.ts';

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

test('sign up requires a valid display name', () => {
  const base = { email: 'a@example.test', password: '12345678' };
  assert.equal(signUpSchema.safeParse({ ...base, displayName: 'Aluno Teste' }).success, true);
  assert.equal(signUpSchema.safeParse({ ...base, displayName: '' }).success, false);
  assert.equal(signUpSchema.safeParse(base).success, false);
});
