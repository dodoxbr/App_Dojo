import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhone, formatPostalCode, phoneSchema, postalCodeSchema, saveContactSchema, ufSchema } from '../src/contacts.ts';
import { CURRENT_TERMS_VERSION, privacyPolicy, termsOfUse } from '../src/terms.ts';

const person = {
  userId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Pessoa de Teste',
  phone: '(11) 99999-0000',
  postalCode: '01001-000',
  street: 'Rua Ficticia',
  number: '10',
  neighborhood: 'Centro',
  city: 'Sao Paulo',
  state: 'sp',
};

test('phone and postal code accept masks and keep only digits', () => {
  assert.equal(phoneSchema.parse('(11) 99999-0000'), '11999990000');
  assert.equal(phoneSchema.parse('11 3333-4444'), '1133334444');
  assert.equal(phoneSchema.safeParse('99999-0000').success, false);
  assert.equal(postalCodeSchema.parse('01001-000'), '01001000');
  assert.equal(postalCodeSchema.safeParse('0100').success, false);
});

test('UF must be a real Brazilian state', () => {
  assert.equal(ufSchema.parse(' sp '), 'SP');
  assert.equal(ufSchema.safeParse('XX').success, false);
});

test('the ficha needs name, phone, address; complement is optional', () => {
  const ok = saveContactSchema.parse(person);
  assert.equal(ok.state, 'SP');
  assert.equal(ok.complement, undefined);
  assert.equal(saveContactSchema.safeParse({ ...person, street: '' }).success, false);
  assert.equal(saveContactSchema.safeParse({ ...person, fullName: 'P' }).success, false);
  assert.equal(saveContactSchema.safeParse({ ...person, userId: 'nao-e-uuid' }).success, false);
});

test('display helpers', () => {
  assert.equal(formatPhone('11999990000'), '(11) 99999-0000');
  assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  assert.equal(formatPostalCode('01001000'), '01001-000');
});

test('terms are versioned drafts, with no invented company data', () => {
  assert.match(CURRENT_TERMS_VERSION, /^rascunho-/);
  const all = [...termsOfUse, ...privacyPolicy].flatMap((s) => s.paragraphs).join(' ');
  assert.doesNotMatch(all, /CNPJ \d|Ltda|S\.A\./i);
  assert(termsOfUse.length >= 5 && privacyPolicy.length >= 5);
});
