import { z } from 'zod';
import { BRAZIL_UFS } from './contacts.ts';

// Página pública da academia (/a/{slug}). São dados da EMPRESA, publicados só se o gestor marcar. Os mesmos limites estão no banco.

const digits = (v: string) => v.replace(/\D/g, '');
const empty = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// Telefone brasileiro com DDD (10 ou 11 dígitos); aceita máscara e +55.
export function phoneDigits(raw: string): string {
  const d = digits(raw);
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
}
const phone = z.preprocess(
  (v) => {
    const e = empty(v);
    return typeof e === 'string' ? phoneDigits(e) : e;
  },
  z.string().regex(/^\d{10,11}$/, 'Informe o telefone com DDD (10 ou 11 dígitos).').optional(),
);

// Usuário de rede social: aceita "@usuario", "usuario" ou o link completo; guarda só o usuário.
export function socialHandle(raw: string, host: RegExp): string {
  let v = raw.trim();
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?([^/?#]+)\/(?:@)?([^/?#]+)/i);
  if (m && host.test(m[1] ?? '')) v = m[2] ?? '';
  return v.replace(/^@/, '');
}
const handle = (host: RegExp, label: string) =>
  z.preprocess(
    (v) => {
      const e = empty(v);
      return typeof e === 'string' ? socialHandle(e, host) : e;
    },
    z.string().regex(/^[A-Za-z0-9._]{1,30}$/, `Usuário do ${label} inválido (letras, números, ponto e sublinhado).`).optional(),
  );

const httpsUrl = (label: string, max = 300) =>
  z.preprocess(
    empty,
    z
      .string()
      .max(max, `O link de ${label} é longo demais.`)
      .refine((v) => {
        try {
          return new URL(v).protocol === 'https:';
        } catch {
          return false;
        }
      }, `O link de ${label} precisa começar com https://.`)
      .optional(),
  );

const text = (max: number, label: string) => z.preprocess(empty, z.string().trim().max(max, `${label}: no máximo ${max} caracteres.`).optional());

export const academyProfileSchema = z.object({
  isPublic: z.boolean().default(false),
  tagline: text(120, 'Frase de apresentação'),
  description: text(1200, 'Descrição'),
  // "Jiu-Jitsu, Kids, Feminino" ou uma por linha
  modalities: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(/[,\n;]/) : v),
    z.array(z.string().trim().max(40)).transform((a) => [...new Set(a.filter(Boolean))]).pipe(z.array(z.string()).max(12, 'No máximo 12 modalidades.')),
  ),
  phone,
  whatsapp: phone,
  address: text(200, 'Endereço'),
  city: text(80, 'Cidade'),
  state: z.preprocess((v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim().toUpperCase()) : v), z.enum(BRAZIL_UFS).optional()),
  mapsUrl: httpsUrl('localização', 500),
  instagram: handle(/instagram\.com$/i, 'Instagram'),
  facebookUrl: httpsUrl('Facebook'),
  youtubeUrl: httpsUrl('YouTube'),
  tiktok: handle(/tiktok\.com$/i, 'TikTok'),
  websiteUrl: httpsUrl('site'),
});

// Grade de horários (divulgação; não cria aula nem presença). 1 = segunda … 7 = domingo.
export const weekdayShort = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const weekdayLong = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use 07:00).');
export const scheduleLineSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).min(1, 'Marque pelo menos um dia.').max(7).transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  times: z.array(timeStr).min(1, 'Informe pelo menos um horário.').max(8, 'No máximo 8 horários por linha.'),
  label: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(40, 'Rótulo: no máximo 40 caracteres.').optional()),
});
export const scheduleGroupSchema = z.object({
  title: z.string().trim().min(1, 'Dê um nome ao grupo (ex.: Adulto, Infantil).').max(60, 'Nome do grupo: no máximo 60 caracteres.'),
  note: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(120, 'Observação: no máximo 120 caracteres.').optional()),
  lines: z.array(scheduleLineSchema).min(1, 'Cada grupo precisa de pelo menos uma linha de horário.').max(8, 'No máximo 8 linhas por grupo.'),
});
export const scheduleSchema = z.array(scheduleGroupSchema).max(12, 'No máximo 12 grupos.');
export type ScheduleGroup = z.infer<typeof scheduleGroupSchema>;

// "07:00" -> "7h", "20:30" -> "20h30"
export function formatClock(t: string): string {
  const [h = '', m = ''] = t.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function joinTimes(times: string[]): string {
  const f = times.map(formatClock);
  return f.length <= 1 ? (f[0] ?? '') : `${f.slice(0, -1).join(', ')} e ${f[f.length - 1]}`;
}

// [1,3] -> "Seg / Qua"; [1,2,3,4,5] -> "Seg a Sex"; [1,3,5] -> "Seg / Qua / Sex"
export function formatDays(days: number[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  const consecutive = d.length >= 3 && d.every((v, i) => i === 0 || v === (d[i - 1] ?? 0) + 1);
  if (consecutive) return `${weekdayShort[d[0] ?? 1]} a ${weekdayShort[d[d.length - 1] ?? 1]}`;
  return d.map((v) => weekdayShort[v]).join(' / ');
}

// Texto livre "07:00, 09:00 e 12:00" -> ["07:00","09:00","12:00"] (aceita "7h", "7h30", "7:30"). Devolve null se algum horário for inválido.
export function parseTimes(raw: string): string[] | null {
  const parts = raw.split(/[,;\n]|\se\s/i).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})(?::|h)?(\d{2})?$/i);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] ?? '0');
    if (h > 23 || min > 59) return null;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

export type AcademyProfileInput = z.infer<typeof academyProfileSchema>;

// O que a página pública recebe do banco (`public_academy_page`).
export const publicAcademyPageSchema = z.object({
  academy_id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  logo_version: z.string().nullable(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  modalities: z.array(z.string()).default([]),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  maps_url: z.string().nullable(),
  instagram: z.string().nullable(),
  facebook_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
  tiktok: z.string().nullable(),
  website_url: z.string().nullable(),
  schedule: scheduleSchema.catch([]).default([]),
});
export type PublicAcademyPage = z.infer<typeof publicAcademyPageSchema>;

export const whatsappLink = (d: string, text?: string) => `https://wa.me/55${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = (d: string) => `tel:+55${d}`;
export const instagramLink = (h: string) => `https://www.instagram.com/${h}/`;
export const tiktokLink = (h: string) => `https://www.tiktok.com/@${h}`;
// Pesquisa no Google Maps pelo endereço, usada quando o gestor não informou um link de localização.
export const mapsSearchLink = (address: string, city?: string | null, state?: string | null) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, city, state].filter(Boolean).join(', '))}`;

export function addressLine(p: { address: string | null; city: string | null; state: string | null }): string | null {
  const place = [p.city, p.state].filter(Boolean).join(' - ');
  return [p.address, place].filter(Boolean).join(' · ') || null;
}
