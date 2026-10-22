import { z } from 'zod';

// PAR-Q (Questionário de Prontidão para Atividade Física). TEXTO DE REFERÊNCIA do PAR-Q padrão (7 perguntas de sim/não), a ser
// revisado por profissional de saúde antes do uso com alunos reais (docs/11). Qualquer "sim" gera um alerta: avaliação médica antes
// de treinar. O resultado só INFORMA: não bloqueia treino nem presença. É dado de saúde (sensível).
export const PARQ_VERSION = 'rascunho-2026-12';
export const PARQ_VALIDITY_DAYS = 365;

export const parqQuestions = [
  'Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?',
  'Você sente dores no peito quando pratica atividade física?',
  'No último mês, você sentiu dores no peito quando não estava praticando atividade física?',
  'Você apresenta desequilíbrio devido a tontura e/ou perda de consciência?',
  'Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?',
  'Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?',
  'Você sabe de alguma outra razão pela qual não deve praticar atividade física?',
] as const;

export const PARQ_QUESTION_COUNT = parqQuestions.length;

// A assinatura desenhada chega como imagem PNG em data URL (base64). Limite: cerca de 150 KB de imagem.
export const MAX_SIGNATURE_DATA_URL = 210_000;
const PNG_PREFIX = 'data:image/png;base64,';
export const signatureDataUrlSchema = z
  .string()
  .max(MAX_SIGNATURE_DATA_URL, 'A assinatura ficou grande demais. Limpe e assine de novo.')
  .refine((v) => v.startsWith(PNG_PREFIX) && /^[A-Za-z0-9+/]+={0,2}$/.test(v.slice(PNG_PREFIX.length)) && v.length > PNG_PREFIX.length + 300, 'Assine na área indicada antes de confirmar.');

export const parqSubmitSchema = z.object({
  answers: z.array(z.boolean()).length(PARQ_QUESTION_COUNT, 'Responda as 7 perguntas.'),
  notes: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(500, 'A observação pode ter até 500 caracteres.').optional()),
  signaturePng: signatureDataUrlSchema,
});

// Só o conteúdo do PNG (sem o prefixo do data URL), em bytes.
export function signatureBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(PNG_PREFIX.length);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export const parqRowSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
  valid_until: z.string(),
  expired: z.boolean(),
  has_flag: z.boolean(),
  answers: z.array(z.boolean()),
  notes: z.string().nullable(),
  signed_name: z.string(),
  certificate_checked_at: z.string().nullable().optional(),
});
export type ParqRow = z.infer<typeof parqRowSchema>;

export const parqStatusRowSchema = z.object({
  user_id: z.uuid(),
  person_name: z.string(),
  is_minor: z.boolean(),
  answered_at: z.string().nullable(),
  has_flag: z.boolean().nullable(),
  expired: z.boolean(),
  certificate_checked: z.boolean().optional(),
});
export type ParqStatusRow = z.infer<typeof parqStatusRowSchema>;

export type ParqState = 'none' | 'ok' | 'attention' | 'certificate' | 'expired';

// A situação para mostrar em telas: sem resposta, vencido (mais de 12 meses), em atenção (algum "sim") ou ok.
export function parqState(r: { answered_at: string | null; has_flag: boolean | null; expired: boolean; certificate_checked?: boolean }): ParqState {
  if (!r.answered_at) return 'none';
  if (r.expired) return 'expired';
  if (!r.has_flag) return 'ok';
  return r.certificate_checked ? 'certificate' : 'attention';
}

export const parqStateLabels: Record<ParqState, string> = {
  none: 'Não respondeu',
  ok: 'Sem alertas',
  attention: 'Atestado médico pendente',
  certificate: 'Atestado conferido',
  expired: 'Vencido',
};

export const parqAdvice =
  'Você marcou "sim" em pelo menos uma pergunta. Você precisará apresentar um atestado médico físico à academia (o professor ou o gestor marca quando conferir), e vale conversar com um médico antes de começar ou continuar a treinar. Pode salvar as respostas agora. O PAR-Q não é um diagnóstico: é um aviso para a sua segurança.';
