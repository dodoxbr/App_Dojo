import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONE_THRESHOLD, milestoneStudentSchema, milestoneSummarySchema, myMilestoneSchema, rankLabel } from '../src/milestone.ts';

const ID = '11111111-1111-4111-8111-111111111111';

test('o marco é de 30 treinos (pedido do professor)', () => {
  assert.equal(MILESTONE_THRESHOLD, 30);
});

test('rótulo da graduação: com e sem faixa registrada', () => {
  assert.equal(rankLabel(null, null, null), 'sem graduação registrada');
  assert.equal(rankLabel('Faixa Teste A', 2, '2026-03-05'), 'Faixa Teste A, grau 2 (desde 05/03/2026)');
  assert.equal(rankLabel('Faixa Teste A', null, null), 'Faixa Teste A, grau 0');
});

test('o que o banco devolve é aceito, inclusive sem faixa', () => {
  assert.equal(myMilestoneSchema.safeParse({ academy_id: ID, academy_name: 'A', attendances: 30, belt_code: null, degree: null, rank_since: null }).success, true);
  assert.equal(milestoneStudentSchema.safeParse({ user_id: ID, person_name: 'Ana', is_minor: false, belt_code: 'Faixa Teste A', degree: 1, rank_since: '2026-01-01', attendances: 31 }).success, true);
  assert.equal(milestoneSummarySchema.safeParse({ person_name: 'Ana', is_minor: false, belt_code: null, degree: null, rank_since: null, attendances: 3, threshold: 30, health_visible: false, health_notes: null }).success, true);
});
