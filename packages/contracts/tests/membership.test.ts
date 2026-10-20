import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from '../src/auth.ts';
import { addMemberSchema, decideMembershipSchema, endMembershipSchema } from '../src/membership.ts';

test('redirect only to internal paths', () => {
  assert.equal(safeRedirectPath('/entrar/academia-teste'), '/entrar/academia-teste');
  assert.equal(safeRedirectPath('//evil.example'), '/perfil');
  assert.equal(safeRedirectPath('https://evil.example'), '/perfil');
  assert.equal(safeRedirectPath('/\\evil.example'), '/perfil');
  assert.equal(safeRedirectPath('/ok\nHeader: x'), '/perfil');
  assert.equal(safeRedirectPath(undefined), '/perfil');
  assert.equal(safeRedirectPath(null, '/inicio'), '/inicio');
});

test('add member allows only student or instructor', () => {
  assert.equal(addMemberSchema.safeParse({ email: ' A@Example.test ', role: 'instructor' }).success, true);
  assert.equal(addMemberSchema.safeParse({ email: 'a@example.test', role: 'manager' }).success, false);
  assert.equal(addMemberSchema.parse({ email: ' A@Example.test ', role: 'student' }).email, 'a@example.test');
});

test('decision needs a valid decision, ids and an optional bounded reason', () => {
  const base = { membershipId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
  assert.equal(decideMembershipSchema.safeParse({ ...base, decision: 'approved' }).success, true);
  assert.equal(decideMembershipSchema.safeParse({ ...base, decision: 'maybe' }).success, false);
  assert.equal(decideMembershipSchema.safeParse({ ...base, decision: 'approved', reason: 'x'.repeat(501) }).success, false);
  assert.equal(decideMembershipSchema.parse({ ...base, decision: 'rejected', reason: '   ' }).reason, undefined);
});

test('end membership needs a membership id', () => {
  assert.equal(endMembershipSchema.safeParse({ membershipId: 'nao-uuid' }).success, false);
  assert.equal(endMembershipSchema.safeParse({ membershipId: crypto.randomUUID(), reason: 'saiu' }).success, true);
});
