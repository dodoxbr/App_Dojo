import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessSkillSchema,
  createCurriculumSchema,
  declareSkillSchema,
  summarizeTrail,
  updateCurriculumSchema,
} from '../src/curriculum.ts';

const uuid = () => crypto.randomUUID();

test('curriculum: title and optional level', () => {
  const ok = { academyId: uuid(), title: '  Faixa Branca ', level: ' Básico ', idempotencyKey: uuid() };
  assert.equal(createCurriculumSchema.parse(ok).title, 'Faixa Branca');
  assert.equal(createCurriculumSchema.parse(ok).level, 'Básico');
  assert.equal(createCurriculumSchema.parse({ ...ok, level: '' }).level, undefined);
  assert.equal(createCurriculumSchema.safeParse({ ...ok, title: 'x' }).success, false);
  assert.equal(updateCurriculumSchema.parse({ title: 'Faixa Azul', isActive: 'on' }).isActive, true);
  assert.equal(updateCurriculumSchema.parse({ title: 'Faixa Azul' }).isActive, false);
});

test('a student can declare studied/practicing but never validated', () => {
  const base = { academyId: uuid(), techniqueId: uuid() };
  assert.equal(declareSkillSchema.safeParse({ ...base, status: 'studied' }).success, true);
  assert.equal(declareSkillSchema.safeParse({ ...base, status: 'practicing' }).success, true);
  assert.equal(declareSkillSchema.safeParse({ ...base, status: 'validated' }).success, false);
});

test('a teacher may set any of the four statuses', () => {
  const base = { academyId: uuid(), userId: uuid(), techniqueId: uuid(), idempotencyKey: uuid() };
  for (const status of ['not_started', 'studied', 'practicing', 'validated']) {
    assert.equal(assessSkillSchema.safeParse({ ...base, status }).success, true, status);
  }
  assert.equal(assessSkillSchema.safeParse({ ...base, status: 'perfeito' }).success, false);
  assert.equal(assessSkillSchema.safeParse({ ...base, status: 'validated', note: 'x'.repeat(501) }).success, false);
});

test('trail summary counts only validated skills', () => {
  const items = [
    { techniqueId: 'a', required: true },
    { techniqueId: 'b', required: true },
    { techniqueId: 'c', required: false },
  ];
  const status = new Map([['a', 'validated'], ['b', 'practicing'], ['c', 'validated'], ['z', 'validated']]);
  assert.deepEqual(summarizeTrail(items, status), { total: 3, required: 2, requiredValidated: 1, validated: 2 });
  assert.deepEqual(summarizeTrail([], new Map()), { total: 0, required: 0, requiredValidated: 0, validated: 0 });
});
