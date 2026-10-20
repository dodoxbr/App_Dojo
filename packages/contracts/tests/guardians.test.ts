import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptFinancialSchema,
  consentStepLabel,
  createDependentSchema,
  inviteCodeSchema,
  verifyConsentSchema,
} from '../src/guardians.ts';

const key = '11111111-1111-4111-8111-111111111111';
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
};

test('only minors can be dependents', () => {
  const base = { displayName: 'Crianca Teste', relationship: 'mãe', idempotencyKey: key };
  assert.equal(createDependentSchema.safeParse({ ...base, birthDate: yearsAgo(9) }).success, true);
  assert.equal(createDependentSchema.safeParse({ ...base, birthDate: yearsAgo(18) }).success, false);
  assert.equal(createDependentSchema.safeParse({ ...base, birthDate: '2999-01-01' }).success, false);
  assert.equal(createDependentSchema.safeParse({ ...base, birthDate: yearsAgo(9), relationship: 'x' }).success, false);
});

test('the manager must confirm the document was checked in person', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  assert.equal(verifyConsentSchema.safeParse({ consentId: id, documentChecked: true }).success, true);
  assert.equal(verifyConsentSchema.safeParse({ consentId: id, documentChecked: false }).success, false);
});

test('invite codes forgive case and spaces but keep the format', () => {
  assert.equal(inviteCodeSchema.parse(' ab12cd34ef '), 'AB12CD34EF');
  assert.equal(inviteCodeSchema.safeParse('curto').success, false);
  assert.equal(acceptFinancialSchema.safeParse({ code: 'AB12CD34EF', relationship: 'tio' }).success, true);
});

test('the guardian is told the next step of the paperwork', () => {
  assert.match(consentStepLabel({ consent_status: 'pending', consent_active: true, membership_status: 'pending' }), /conferir/);
  assert.match(consentStepLabel({ consent_status: 'verified', consent_active: true, membership_status: 'pending' }), /aprovar/);
  assert.match(consentStepLabel({ consent_status: 'verified', consent_active: true, membership_status: 'approved' }), /ativa/);
  assert.match(consentStepLabel({ consent_status: 'verified', consent_active: false, membership_status: 'suspended' }), /revogado/);
});
