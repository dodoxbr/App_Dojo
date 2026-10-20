import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancelSessionSchema, createClassSchema, createSessionSchema, formatSessionRange, updateClassSchema } from '../src/classes.ts';

const uuid = () => crypto.randomUUID();

test('class: title bounds and uuids', () => {
  const ok = { academyId: uuid(), title: '  Turma Iniciantes ', instructorUserId: uuid(), idempotencyKey: uuid() };
  assert.equal(createClassSchema.parse(ok).title, 'Turma Iniciantes');
  assert.equal(createClassSchema.safeParse({ ...ok, title: 'x' }).success, false);
  assert.equal(createClassSchema.safeParse({ ...ok, instructorUserId: 'nao-uuid' }).success, false);
});

test('class update: checkbox becomes a boolean', () => {
  const base = { title: 'Turma Noite', instructorUserId: uuid() };
  assert.equal(updateClassSchema.parse({ ...base, isActive: 'on' }).isActive, true);
  assert.equal(updateClassSchema.parse(base).isActive, false);
});

test('session: real date, HH:MM times, end after start', () => {
  const base = { date: '2026-11-02', start: '19:00', end: '20:00', idempotencyKey: uuid() };
  assert.equal(createSessionSchema.safeParse(base).success, true);
  assert.equal(createSessionSchema.safeParse({ ...base, end: '19:00' }).success, false);
  assert.equal(createSessionSchema.safeParse({ ...base, end: '18:00' }).success, false);
  assert.equal(createSessionSchema.safeParse({ ...base, start: '7:00' }).success, false);
  assert.equal(createSessionSchema.safeParse({ ...base, start: '24:00' }).success, false);
  assert.equal(createSessionSchema.safeParse({ ...base, date: '2026-02-30' }).success, false);
});

test('cancel: reason is optional and bounded', () => {
  assert.equal(cancelSessionSchema.parse({ sessionId: uuid(), reason: '  ' }).reason, undefined);
  assert.equal(cancelSessionSchema.safeParse({ sessionId: uuid(), reason: 'x'.repeat(501) }).success, false);
});

test('session range is shown in the academy time zone', () => {
  // 22:00Z on 02/11/2026 is 19:00 in Sao Paulo (UTC-3, no DST in 2026)
  const text = formatSessionRange('2026-11-02T22:00:00Z', '2026-11-02T23:00:00Z', 'America/Sao_Paulo');
  assert.match(text, /02\/11/);
  assert.match(text, /19:00–20:00/);
});
