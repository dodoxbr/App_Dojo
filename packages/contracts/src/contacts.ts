import { z } from 'zod';

// US-016: registration form (ficha). Mirrors the database constraints; the database validates again.
export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const digits = (v: string) => v.replace(/\D/g, '');

// Phone with area code: 10 digits (landline) or 11 digits (mobile). Mask and spaces are accepted.
export const phoneSchema = z
  .string()
  .transform(digits)
  .pipe(z.string().regex(/^\d{10,11}$/, 'Informe o telefone com DDD (10 ou 11 dígitos).'));

export const postalCodeSchema = z
  .string()
  .transform(digits)
  .pipe(z.string().regex(/^\d{8}$/, 'Informe o CEP com 8 dígitos.'));

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v): v is (typeof BRAZIL_UFS)[number] => (BRAZIL_UFS as readonly string[]).includes(v), 'Informe a sigla do estado (UF).');

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Informe ${label}.`).max(max, `${label} muito longo(a).`);

export const saveContactSchema = z.object({
  userId: z.uuid(),
  fullName: text(2, 160, 'o nome completo'),
  phone: phoneSchema,
  postalCode: postalCodeSchema,
  street: text(2, 160, 'a rua'),
  number: text(1, 20, 'o número'),
  complement: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  neighborhood: text(2, 80, 'o bairro'),
  city: text(2, 80, 'a cidade'),
  state: ufSchema,
});

export const contactRowSchema = z.object({
  full_name: z.string(),
  phone: z.string(),
  postal_code: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().nullable(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  updated_at: z.string(),
});

export const contactStatusSchema = z.object({ user_id: z.uuid(), has_contact: z.boolean() });

export function formatPhone(d: string): string {
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
}

export function formatPostalCode(d: string): string {
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type SaveContactInput = z.infer<typeof saveContactSchema>;
export type ContactRow = z.infer<typeof contactRowSchema>;
