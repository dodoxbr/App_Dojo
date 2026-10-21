import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chargeStatusText,
  chargeTitle,
  createChargeSchema,
  formatCents,
  markPaidSchema,
  moneySchema,
  monthLabel,
  parseMoneyToCents,
  reasonSchema,
  setPlanSchema,
  shiftMonth,
} from '../src/finance.ts';

test('money is parsed to cents without floating point surprises', () => {
  assert.equal(parseMoneyToCents('150'), 15000);
  assert.equal(parseMoneyToCents('150,5'), 15050);
  assert.equal(parseMoneyToCents('150,00'), 15000);
  assert.equal(parseMoneyToCents('1.500,00'), 150000);
  assert.equal(parseMoneyToCents('1.500'), 150000, 'ponto de milhar no formato brasileiro');
  assert.equal(parseMoneyToCents('R$ 89,90'), 8990);
  assert.equal(parseMoneyToCents('0,10'), 10);
  assert.equal(parseMoneyToCents('150.50'), 15050);
  assert.equal(parseMoneyToCents('-5'), null);
  assert.equal(parseMoneyToCents('1,234'), null);
  assert.equal(parseMoneyToCents('abc'), null);
  assert.equal(parseMoneyToCents(''), null);
});

test('amounts must be positive and at most R$ 100.000,00', () => {
  assert.equal(moneySchema.parse('89,90'), 8990);
  assert.equal(moneySchema.safeParse('0').success, false);
  assert.equal(moneySchema.safeParse('100.000,01').success, false);
  assert.equal(moneySchema.safeParse('100.000,00').success, true);
});

test('cents are shown in reais', () => {
  assert.match(formatCents(15000), /R\$\s?150,00/);
  assert.match(formatCents(8990), /R\$\s?89,90/);
});

test('a plan needs a value chosen by the academy and a due day 1..28', () => {
  const base = { userId: '11111111-1111-4111-8111-111111111111', amount: '150,00', dueDay: '10', startsOn: '2026-10-01', active: true };
  assert.equal(setPlanSchema.parse(base).amount, 15000);
  assert.equal(setPlanSchema.safeParse({ ...base, dueDay: '29' }).success, false);
  assert.equal(setPlanSchema.safeParse({ ...base, dueDay: '0' }).success, false);
  assert.equal(setPlanSchema.safeParse({ ...base, amount: '' }).success, false);
});

test('a discount is a fixed amount below the plan value and always has a reason', () => {
  const base = { userId: '11111111-1111-4111-8111-111111111111', amount: '200,00', dueDay: '10', startsOn: '2026-10-01', active: true };
  assert.equal(setPlanSchema.parse(base).discount, 0, 'sem desconto por padrão');
  assert.equal(setPlanSchema.parse({ ...base, discount: '50,00', discountNote: 'irmãos' }).discount, 5000);
  assert.equal(setPlanSchema.safeParse({ ...base, discount: '50,00' }).success, false, 'desconto sem motivo');
  assert.equal(setPlanSchema.safeParse({ ...base, discount: '200,00', discountNote: 'bolsa' }).success, false, 'desconto igual ao valor');
  assert.equal(setPlanSchema.safeParse({ ...base, discount: 'abc', discountNote: 'bolsa' }).success, false);
});

test('one-off charges, payments and reasons', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(createChargeSchema.safeParse({ userId: id, description: 'Taxa de exame', amount: '50', dueDate: '2026-11-01', idempotencyKey: id }).success, true);
  assert.equal(createChargeSchema.safeParse({ userId: id, description: 'X', amount: '50', dueDate: '2026-11-01', idempotencyKey: id }).success, false);
  assert.equal(markPaidSchema.safeParse({ chargeId: id, method: 'pix', paidOn: '2026-10-20' }).success, true);
  assert.equal(markPaidSchema.safeParse({ chargeId: id, method: 'bitcoin', paidOn: '2026-10-20' }).success, false);
  assert.equal(reasonSchema.safeParse({ chargeId: id, reason: 'ok' }).success, false);
  assert.equal(reasonSchema.safeParse({ chargeId: id, reason: 'duplicada' }).success, true);
});

test('months navigate across year boundaries', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-10', 0), '2026-10');
  assert.match(monthLabel('2026-10'), /outubro/);
});

test('labels: overdue only applies to open charges', () => {
  assert.equal(chargeStatusText({ status: 'open', overdue: true }), 'Atrasada');
  assert.equal(chargeStatusText({ status: 'open', overdue: false }), 'Em aberto');
  assert.equal(chargeStatusText({ status: 'paid', overdue: true }), 'Pago');
  assert.match(chargeTitle({ kind: 'monthly', description: null, reference_month: '2026-10-01' }), /Mensalidade outubro/);
  assert.equal(chargeTitle({ kind: 'other', description: 'Taxa de exame', reference_month: null }), 'Taxa de exame');
});
