import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureKeys, featureLabels, featureOffMessage, isFeatureKey, knownFeatures, planRowSchema, setPlanSchema } from '../src/features.ts';

test('toda funcionalidade tem texto em português e a lista não repete', () => {
  assert.equal(new Set(featureKeys).size, featureKeys.length);
  for (const k of featureKeys) assert.ok(featureLabels[k].length > 3);
});

test('só chaves conhecidas valem', () => {
  assert.equal(isFeatureKey('finance'), true);
  assert.equal(isFeatureKey('inexistente'), false);
  assert.deepEqual(knownFeatures(['feed', 'x', 'medals']), ['feed', 'medals']);
});

test('mensagem de funcionalidade fora do pacote', () => {
  assert.equal(featureOffMessage('finance'), 'Financeiro manual não está incluído no pacote desta academia.');
});

test('o que o banco devolve é aceito e o pacote é validado', () => {
  assert.equal(planRowSchema.safeParse({ code: 'inicial', name: 'Inicial', position: 1, features: [] }).success, true);
  const ok = setPlanSchema.safeParse({ academyId: '11111111-1111-4111-8111-111111111111', planCode: 'avancado' });
  assert.equal(ok.success, true);
  assert.equal(setPlanSchema.safeParse({ academyId: 'x', planCode: 'avancado' }).success, false);
  assert.equal(setPlanSchema.safeParse({ academyId: '11111111-1111-4111-8111-111111111111', planCode: 'Pacote Grande!' }).success, false);
});
