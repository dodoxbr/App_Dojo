import { z } from 'zod';

// US-018: photo feed of the academy. The picture is processed by the server (metadata removed) before it reaches the database.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // raw upload
export const MAX_STORED_BYTES = 800_000; // after processing (matches the database check)
export const MAX_IMAGE_SIDE = 1600;
export const FEED_RETENTION_DAYS = 30;
export const CAPTION_MAX = 500;
export const MAX_TAGS = 30;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const uploadFieldsSchema = z.object({
  academyId: z.uuid(),
  caption: z.string().trim().max(CAPTION_MAX, 'A legenda pode ter até 500 caracteres.').optional().transform((v) => (v ? v : undefined)),
  hasMinors: z.boolean(),
  tagIds: z.array(z.uuid()).max(MAX_TAGS, 'Marque no máximo 30 pessoas.'),
  clientKey: z.uuid(),
});

export const feedPostSchema = z.object({
  id: z.uuid(),
  author_name: z.string(),
  caption: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  has_minors: z.boolean(),
  status: z.enum(['visible', 'hidden']),
  hidden_reason: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  tags: z.array(z.object({ id: z.uuid(), name: z.string() })),
  mine: z.boolean(),
  can_manage: z.boolean(),
  reported_by_me: z.boolean(),
  social_ok: z.boolean(),
  reactions: z.number(),
  reacted_by_me: z.boolean(),
  comments: z.number(),
});

// What the legal guardian sees: only the posts that show their own minor.
export const dependentPostSchema = z.object({
  id: z.uuid(),
  academy_name: z.string(),
  author_name: z.string(),
  caption: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  width: z.number(),
  height: z.number(),
});

export const feedPersonSchema = z.object({
  user_id: z.uuid(),
  person_name: z.string(),
  is_minor: z.boolean(),
  photo_ok: z.boolean(),
});

export const reportSchema = z.object({
  postId: z.uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo (mínimo 3 caracteres).').max(300, 'Motivo muito longo.'),
});

// US-019: comments (adults only, 1 to 300 characters) and medals (computed by the database from validated attendance).
export const COMMENT_MAX = 300;
export const COMMENTS_PER_DAY = 30;

export const commentInputSchema = z.object({
  postId: z.uuid(),
  body: z.string().trim().min(1, 'Escreva o comentário.').max(COMMENT_MAX, 'O comentário pode ter até 300 caracteres.'),
  clientKey: z.uuid(),
});

export const commentSchema = z.object({
  id: z.uuid(),
  author_name: z.string(),
  body: z.string(),
  created_at: z.string(),
  status: z.enum(['visible', 'hidden']),
  mine: z.boolean(),
  can_manage: z.boolean(),
  reported_by_me: z.boolean(),
});

export const commentReportSchema = z.object({
  commentId: z.uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo (mínimo 3 caracteres).').max(300, 'Motivo muito longo.'),
});

export const medalSchema = z.object({
  code: z.string(),
  title: z.string(),
  earned_on: z.string(),
  challenge_id: z.uuid().nullable(),
});

export const academyMedalSchema = medalSchema.extend({ user_id: z.uuid(), person_name: z.string() });
export const dependentMedalSchema = medalSchema.extend({ academy_id: z.uuid(), academy_name: z.string() });

export const hiddenReasonLabels: Record<string, string> = {
  reported: 'denunciada por um membro; aguarda a decisão do gestor',
  'consent revoked': 'o responsável de um menor marcado revogou o consentimento de foto',
};

// Whole days left before the picture is deleted (never negative).
export function daysLeft(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedComment = z.infer<typeof commentSchema>;
export type Medal = z.infer<typeof medalSchema>;
export type FeedPerson = z.infer<typeof feedPersonSchema>;
export type DependentPost = z.infer<typeof dependentPostSchema>;
