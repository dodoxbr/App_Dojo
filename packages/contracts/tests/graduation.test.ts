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

import { buildRankHistory, correctPromotionSchema, grantPromotionSchema, type PromotionEvent } from '../src/graduation.ts';

const ev = (over: Partial<PromotionEvent> & Pick<PromotionEvent, 'id' | 'effective_date' | 'created_at'>): PromotionEvent => ({
  event_type: 'promotion', belt_code: 'Faixa Teste A', degree: 1, corrects_promotion_id: null, reason: null,
  previous_belt_code: null, previous_degree: null, ...over,
});

test('granting needs a justification and a date that is not in the future', () => {
  const base = { academyId: uuid(), userId: uuid(), beltCode: 'Faixa Teste A', degree: 2, effectiveDate: '2026-10-01', idempotencyKey: uuid() };
  assert.equal(grantPromotionSchema.safeParse({ ...base, reason: 'avaliação do gestor' }).success, true);
  assert.equal(grantPromotionSchema.safeParse({ ...base, reason: 'ok' }).success, false);
  assert.equal(grantPromotionSchema.safeParse({ ...base, reason: '   ' }).success, false);
  assert.equal(grantPromotionSchema.safeParse({ ...base, reason: 'avaliação', effectiveDate: '2999-01-01' }).success, false);
  assert.equal(grantPromotionSchema.safeParse({ ...base, reason: 'avaliação', degree: 21 }).success, false);
});

test('rectification needs the event, the right values and a justification', () => {
  const base = { promotionId: uuid(), beltCode: 'Faixa Teste B', degree: 0, effectiveDate: '2026-10-01', idempotencyKey: uuid() };
  assert.equal(correctPromotionSchema.safeParse({ ...base, reason: 'grau digitado errado' }).success, true);
  assert.equal(correctPromotionSchema.safeParse({ ...base, reason: 'x' }).success, false);
  assert.equal(correctPromotionSchema.safeParse({ ...base, promotionId: 'x', reason: 'grau digitado errado' }).success, false);
});

test('history: the current rank is the latest event not superseded by a correction', () => {
  const initial = ev({ id: 'a', event_type: 'initial', effective_date: '2026-01-01', created_at: '2026-01-01T10:00:00Z' });
  const promoted = ev({ id: 'b', degree: 2, effective_date: '2026-06-01', created_at: '2026-06-01T10:00:00Z' });
  const fixed = ev({ id: 'c', event_type: 'correction', degree: 3, effective_date: '2026-06-01', created_at: '2026-06-02T10:00:00Z', corrects_promotion_id: 'b' });
  const r = buildRankHistory([initial, promoted, fixed]);
  assert.equal(r.history.length, 3);
  assert.equal(r.current?.id, 'c');
  assert.equal(r.history.find((e) => e.id === 'b')?.superseded, true);
  assert.equal(r.history.find((e) => e.id === 'a')?.superseded, false);
  // a correction of the correction wins
  const again = ev({ id: 'd', event_type: 'correction', degree: 1, effective_date: '2026-06-01', created_at: '2026-06-03T10:00:00Z', corrects_promotion_id: 'c' });
  assert.equal(buildRankHistory([initial, promoted, fixed, again]).current?.id, 'd');
  assert.equal(buildRankHistory([]).current, null);
});
