import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessManualSchema,
  createRuleSchema,
  evaluationSchema,
  progressText,
  registerRankSchema,
  toDbCriteria,
} from '../src/graduation.ts';

const uuid = () => crypto.randomUUID();
// All values are fictitious test data.
const rule = () => ({
  academyId: uuid(),
  beltCode: 'Faixa Teste A',
  degree: 1,
  effectiveFrom: '2026-10-01',
  idempotencyKey: uuid(),
  criteria: [
    { kind: 'min_days', label: 'Tempo', minDays: 20 },
    { kind: 'attendance', label: 'Assiduidade', minAttendances: 5, windowDays: 30, distinctDays: true },
    { kind: 'curriculum', label: 'Nível técnico', curriculumId: uuid(), minPercent: 60 },
    { kind: 'manual', label: 'Comprometimento' },
  ],
});

test('a rule combines the four kinds of criteria', () => {
  const parsed = createRuleSchema.parse(rule());
  assert.equal(parsed.criteria.length, 4);
  assert.equal(parsed.degree, 1);
});

test('a rule needs 1 to 20 criteria with distinct names and the parameters of their kind', () => {
  assert.equal(createRuleSchema.safeParse({ ...rule(), criteria: [] }).success, false);
  assert.equal(createRuleSchema.safeParse({ ...rule(), criteria: [{ kind: 'min_days', label: 'Tempo' }] }).success, false);
  assert.equal(createRuleSchema.safeParse({ ...rule(), criteria: [{ kind: 'inventado', label: 'X1' }] }).success, false);
  assert.equal(
    createRuleSchema.safeParse({ ...rule(), criteria: [{ kind: 'manual', label: 'Atitude' }, { kind: 'manual', label: ' atitude ' }] }).success,
    false,
  );
  assert.equal(createRuleSchema.safeParse({ ...rule(), criteria: [{ kind: 'curriculum', label: 'T1', curriculumId: uuid(), minPercent: 101 }] }).success, false);
  assert.equal(createRuleSchema.safeParse({ ...rule(), degree: 21 }).success, false);
  assert.equal(createRuleSchema.safeParse({ ...rule(), effectiveFrom: '2026-13-40' }).success, false);
});

test('criteria are sent to the database in the shape it expects', () => {
  const db = toDbCriteria(createRuleSchema.parse(rule()).criteria);
  assert.deepEqual(db[0], { kind: 'min_days', label: 'Tempo', min_days: 20 });
  assert.deepEqual(db[1], { kind: 'attendance', label: 'Assiduidade', min_attendances: 5, window_days: 30, distinct_days: true });
  assert.equal(db[2]?.min_percent, 60);
  assert.deepEqual(db[3], { kind: 'manual', label: 'Comprometimento' });
});

test('rank registration cannot be in the future', () => {
  const base = { academyId: uuid(), userId: uuid(), beltCode: 'Faixa Teste A', degree: 0, idempotencyKey: uuid() };
  assert.equal(registerRankSchema.safeParse({ ...base, effectiveDate: '2026-01-10' }).success, true);
  assert.equal(registerRankSchema.safeParse({ ...base, effectiveDate: '2999-01-01' }).success, false);
});

test('manual assessment input', () => {
  const base = { academyId: uuid(), userId: uuid(), label: 'Comprometimento', met: true, idempotencyKey: uuid() };
  assert.equal(assessManualSchema.safeParse(base).success, true);
  assert.equal(assessManualSchema.safeParse({ ...base, met: 'sim' }).success, false);
  assert.equal(assessManualSchema.safeParse({ ...base, note: 'x'.repeat(501) }).success, false);
});

test('evaluation result is always marked as a recommendation', () => {
  const ok = evaluationSchema.safeParse({ has_rank: false, has_rule: false, eligible: false, recommendation_only: true });
  assert.equal(ok.success, true);
  assert.equal(evaluationSchema.safeParse({ has_rank: true, has_rule: true, eligible: true, recommendation_only: false }).success, false);
  assert.equal(progressText({ kind: 'curriculum', current: 50, target: 60, detail: 'das obrigatórias' }), '50% de 60% — das obrigatórias');
  assert.equal(progressText({ kind: 'manual', current: 0, target: 1, detail: 'ainda não avaliado' }), 'ainda não avaliado');
});
