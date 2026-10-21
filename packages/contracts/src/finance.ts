import { z } from 'zod';

// US-017: manual financial control. Money is always an integer number of cents (BRL). The platform does not process payments.
export const MAX_CENTS = 10_000_000; // R$ 100.000,00 per charge (matches the database check)

export const chargeStatuses = ['open', 'paid', 'cancelled', 'waived'] as const;
export type ChargeStatus = (typeof chargeStatuses)[number];

export const chargeStatusLabels: Record<ChargeStatus, string> = {
  open: 'Em aberto',
  paid: 'Pago',
  cancelled: 'Cancelada',
  waived: 'Isenta',
};

export const paymentMethods = ['cash', 'pix', 'card', 'transfer', 'other'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
  transfer: 'Transferência',
  other: 'Outro',
};

// "150", "150,5", "1.500,00", "R$ 150,00" -> cents. Returns null for anything else (negative, 3 decimals, text).
export function parseMoneyToCents(input: string): number | null {
  const t = input.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t) || /^\d+,\d{1,2}$/.test(t)) normalized = t.replaceAll('.', '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replaceAll('.', '');
  else if (/^\d+(\.\d{1,2})?$/.test(t)) normalized = t;
  else return null;
  const [int = '0', frac = ''] = normalized.split('.');
  const cents = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export const moneySchema = z
  .string()
  .transform((v, ctx) => {
    const cents = parseMoneyToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe um valor em reais, por exemplo 150,00.' });
      return z.NEVER;
    }
    return cents;
  })
  .pipe(z.number().int().min(1, 'O valor deve ser maior que zero.').max(MAX_CENTS, 'O valor máximo por cobrança é R$ 100.000,00.'));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
export const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// 'YYYY-MM' <-> first day of the month, and navigation between months.
export const monthStart = (ym: string) => `${ym}-01`;
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// Optional fixed discount (siblings, scholarship...): empty means none. It must stay below the plan value and always has a reason.
const optionalDiscount = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return 0;
    const cents = parseMoneyToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe o desconto em reais, por exemplo 50,00.' });
      return z.NEVER;
    }
    return cents;
  });

export const setPlanSchema = z.object({
  userId: z.uuid(),
  amount: moneySchema,
  discount: optionalDiscount,
  discountNote: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  dueDay: z.coerce.number().int().min(1, 'O vencimento vai do dia 1 ao 28.').max(28, 'O vencimento vai do dia 1 ao 28.'),
  startsOn: isoDate,
  active: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.discount >= v.amount && v.discount > 0) ctx.addIssue({ code: 'custom', path: ['discount'], message: 'O desconto deve ser menor que o valor do plano (para isentar, use Isentar na cobrança).' });
  if (v.discount > 0 && (!v.discountNote || v.discountNote.length < 2)) ctx.addIssue({ code: 'custom', path: ['discountNote'], message: 'Informe o motivo do desconto (por exemplo: irmãos, bolsa).' });
});

export const createChargeSchema = z.object({
  userId: z.uuid(),
  description: z.string().trim().min(2, 'Descreva a cobrança.').max(120, 'Descrição muito longa.'),
  amount: moneySchema,
  dueDate: isoDate,
  idempotencyKey: z.uuid(),
});

export const markPaidSchema = z.object({
  chargeId: z.uuid(),
  method: z.enum(paymentMethods, { error: 'Escolha a forma de pagamento.' }),
  paidOn: isoDate,
  note: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});

export const reasonSchema = z.object({
  chargeId: z.uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo (mínimo 3 caracteres).').max(500, 'Motivo muito longo.'),
});

export const chargeRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  student_name: z.string(),
  kind: z.enum(['monthly', 'other']),
  description: z.string().nullable(),
  reference_month: z.string().nullable(),
  amount_cents: z.number(),
  due_date: z.string(),
  status: z.enum(chargeStatuses),
  overdue: z.boolean(),
  paid_on: z.string().nullable(),
  paid_method: z.string().nullable(),
  status_note: z.string().nullable(),
  financial_name: z.string().nullable(),
});

export const summarySchema = z.object({
  charges: z.number(),
  billed_cents: z.number(),
  received_cents: z.number(),
  open_cents: z.number(),
  overdue_cents: z.number(),
  waived_cents: z.number(),
  cancelled_cents: z.number(),
  paid_count: z.number(),
  overdue_count: z.number(),
});

export const planRowSchema = z.object({
  user_id: z.uuid(),
  student_name: z.string(),
  is_minor: z.boolean(),
  financial_name: z.string().nullable(),
  amount_cents: z.number().nullable(),
  due_day: z.number().nullable(),
  starts_on: z.string().nullable(),
  active: z.boolean().nullable(),
  discount_cents: z.number().nullable(),
  discount_note: z.string().nullable(),
});

const studentCharge = z.object({
  id: z.uuid(),
  kind: z.enum(['monthly', 'other']),
  description: z.string().nullable(),
  reference_month: z.string().nullable(),
  amount_cents: z.number(),
  due_date: z.string(),
  status: z.enum(chargeStatuses),
  overdue: z.boolean(),
  paid_on: z.string().nullable(),
  paid_method: z.string().nullable(),
  status_note: z.string().nullable(),
});

export const studentFinanceSchema = z.object({
  name: z.string().nullable(),
  plan: z.object({ amount_cents: z.number(), due_day: z.number(), starts_on: z.string(), active: z.boolean(), discount_cents: z.number().optional(), discount_note: z.string().nullable().optional() }).nullable(),
  financial: z.object({ name: z.string(), kind: z.enum(['legal', 'financial']), relationship: z.string() }).nullable(),
  charges: z.array(studentCharge),
  history: z.array(z.object({ charge_id: z.uuid(), event: z.string(), at: z.string(), actor: z.string(), data: z.record(z.string(), z.unknown()) })),
});

export const myChargeSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  person_name: z.string(),
  academy_id: z.uuid(),
  academy_name: z.string(),
  kind: z.enum(['monthly', 'other']),
  description: z.string().nullable(),
  reference_month: z.string().nullable(),
  amount_cents: z.number(),
  due_date: z.string(),
  status: z.enum(chargeStatuses),
  overdue: z.boolean(),
  paid_on: z.string().nullable(),
  paid_method: z.string().nullable(),
});

export const chargeEventLabels: Record<string, string> = {
  created: 'Criada',
  paid: 'Marcada como paga',
  cancelled: 'Cancelada',
  waived: 'Isentada',
  reopened: 'Reaberta',
};

export function chargeTitle(c: { kind: string; description: string | null; reference_month: string | null }): string {
  if (c.kind === 'monthly' && c.reference_month) return `Mensalidade ${monthLabel(c.reference_month.slice(0, 7))}`;
  return c.description ?? 'Cobrança';
}

export function chargeStatusText(c: { status: ChargeStatus; overdue: boolean }): string {
  return c.status === 'open' && c.overdue ? 'Atrasada' : chargeStatusLabels[c.status];
}

export type ChargeRow = z.infer<typeof chargeRowSchema>;
export type Summary = z.infer<typeof summarySchema>;
export type PlanRow = z.infer<typeof planRowSchema>;
export type StudentFinance = z.infer<typeof studentFinanceSchema>;
export type MyCharge = z.infer<typeof myChargeSchema>;
