import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthDateSchema, displayNameSchema, isAdultOn, newPasswordSchema, passwordResetRequestSchema, signInSchema, signUpSchema } from '../src/auth.ts';

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
  const base = { email: 'a@example.test', password: '12345678', birthDate: '1990-01-01', acceptTerms: 'on', healthDeclaration: 'on' };
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

test('pedido de redefinição de senha normaliza o e-mail e recusa e-mail inválido', () => {
  assert.equal(passwordResetRequestSchema.parse({ email: ' A@Example.TEST ' }).email, 'a@example.test');
  assert.equal(passwordResetRequestSchema.safeParse({ email: 'nao-e-email' }).success, false);
  assert.equal(passwordResetRequestSchema.safeParse({}).success, false);
});

test('a nova senha tem de ter 8 a 72 caracteres e ser repetida igual', () => {
  assert.equal(newPasswordSchema.safeParse({ password: '12345678', confirmPassword: '12345678' }).success, true);
  assert.equal(newPasswordSchema.safeParse({ password: '1234567', confirmPassword: '1234567' }).success, false, 'curta demais');
  assert.equal(newPasswordSchema.safeParse({ password: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }).success, false, 'longa demais');
  const diff = newPasswordSchema.safeParse({ password: '12345678', confirmPassword: '87654321' });
  assert.equal(diff.success, false);
  assert.equal(diff.success ? '' : diff.error.issues[0]?.path.join('.'), 'confirmPassword');
});

test('a nova senha curta demais devolve mensagem em português', () => {
  const r = newPasswordSchema.safeParse({ password: '123', confirmPassword: '123' });
  assert.equal(r.success, false);
  assert.equal(r.success ? '' : r.error.issues[0]?.message, 'A senha precisa ter de 8 a 72 caracteres.');
});

test('sign-up: the health declaration is required and the image authorization is optional', () => {
  const base = { email: 'a@example.test', password: '12345678', birthDate: '1990-01-01', acceptTerms: 'on', displayName: 'Aluno Teste' };
  assert.equal(signUpSchema.safeParse({ ...base }).success, false, 'sem a declaração de saúde não cadastra');
  const ok = signUpSchema.parse({ ...base, healthDeclaration: 'on' });
  assert.equal(ok.imageAuthorization, false);
  assert.equal(signUpSchema.parse({ ...base, healthDeclaration: 'on', imageAuthorization: 'on' }).imageAuthorization, true);
});
