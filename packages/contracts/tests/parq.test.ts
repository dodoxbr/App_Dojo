import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARQ_QUESTION_COUNT, parqQuestions, parqState, parqSubmitSchema, signatureBytes } from '../src/parq.ts';
import { healthResponsibilityText, healthResponsibilityTerm } from '../src/terms.ts';

test('PAR-Q: seven yes/no questions', () => {
  assert.equal(parqQuestions.length, 7);
  assert.equal(PARQ_QUESTION_COUNT, 7);
  assert.equal(new Set(parqQuestions).size, 7);
});

const PNG_B64 = 'iVBORw0KGgo' + 'A'.repeat(400);
const sig = `data:image/png;base64,${PNG_B64}`;

test('PAR-Q submit: needs 7 answers and a drawn (PNG) signature; notes are optional and bounded', () => {
  const ok = { answers: Array(7).fill(false), signaturePng: sig };
  assert.equal(parqSubmitSchema.safeParse(ok).success, true);
  assert.equal(parqSubmitSchema.safeParse({ ...ok, answers: [false, true] }).success, false);
  assert.equal(parqSubmitSchema.safeParse({ ...ok, signaturePng: 'data:image/jpeg;base64,AAAA' }).success, false);
  assert.equal(parqSubmitSchema.safeParse({ ...ok, signaturePng: 'data:image/png;base64,AAAA' }).success, false, 'assinatura em branco/curta demais');
  assert.equal(parqSubmitSchema.safeParse({ ...ok, signaturePng: `data:image/png;base64,${'A'.repeat(300_000)}` }).success, false);
  assert.equal(parqSubmitSchema.parse({ ...ok, notes: '   ' }).notes, undefined);
  assert.equal(parqSubmitSchema.safeParse({ ...ok, notes: 'a'.repeat(501) }).success, false);
  assert.equal(signatureBytes(sig)[0], 0x89);
});

test('health responsibility term: sections, deterministic text', () => {
  assert.ok(healthResponsibilityTerm.length >= 4);
  assert.equal(healthResponsibilityText(), healthResponsibilityText());
  assert.ok(healthResponsibilityText().includes('atestado médico físico'));
});

test('PAR-Q state: none, ok, attention, expired', () => {
  assert.equal(parqState({ answered_at: null, has_flag: null, expired: false }), 'none');
  assert.equal(parqState({ answered_at: '2026-10-01', has_flag: false, expired: false }), 'ok');
  assert.equal(parqState({ answered_at: '2026-10-01', has_flag: true, expired: false }), 'attention');
  assert.equal(parqState({ answered_at: '2025-01-01', has_flag: false, expired: true }), 'expired');
  assert.equal(parqState({ answered_at: '2026-10-01', has_flag: true, expired: false, certificate_checked: true }), 'certificate');
});
