import { notFound } from "next/navigation";
import { CAPTION_MAX, COMMENT_MAX, commentSchema, daysLeft, FEED_RETENTION_DAYS, feedPersonSchema, feedPostSchema, hiddenReasonLabels, type FeedComment } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { Alert, Avatar, Button, ButtonLink, Card, EmptyState, Page, PageHero } from "@/components/ui";
import { FeatureOff } from "@/components/feature-off";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { feedMessage } from "@/lib/feed-ui";
import styles from "./feed.module.css";
import { addComment, deleteComment, deletePost, reportComment, reportPost, restoreComment, restorePost, toggleReaction } from "./actions";

const PAGE = 20;

// Photo feed of one academy: every approved member posts and sees. Pictures are served by /api/feed/image under the same rule.
export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ academyId: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; antes?: string }>;
}) {
  const { academyId } = await params;
  const { erro, ok, antes } = await searchParams;
  if (!idSchema.safeParse(academyId).success) notFound();
  const { supabase } = await getCaller();
  if (!(await academyHas(supabase, academyId, "feed"))) return <FeatureOff feature="feed" />;

  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", academyId).maybeSingle();
  if (!academy) notFound();
  const before = antes && !Number.isNaN(Date.parse(antes)) ? new Date(antes).toISOString() : null;
  const [{ data: postsRaw, error: feedError }, { data: peopleRaw }] = await Promise.all([
    supabase.rpc("list_feed", { p_academy_id: academyId, p_before: before, p_limit: PAGE }),
    supabase.rpc("list_feed_people", { p_academy_id: academyId }),
  ]);
  if (feedError) notFound(); // not a member: same answer as an academy that does not exist
  const posts = ((postsRaw ?? []) as unknown[]).map((x) => feedPostSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const people = ((peopleRaw ?? []) as unknown[]).map((x) => feedPersonSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const tz = (academy.timezone as string) ?? "America/Sao_Paulo";
  const message = feedMessage(erro);
  const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  const last = posts[posts.length - 1];

  // The manager also reads why a post was reported.
  const reportsOf = new Map<string, string[]>();
  await Promise.all(
    posts.filter((p) => p.can_manage && !p.mine && p.status === "hidden" && p.hidden_reason === "reported").map(async (p) => {
      const { data } = await supabase.rpc("list_feed_reports", { p_post_id: p.id });
      reportsOf.set(p.id, ((data ?? []) as { reason: string }[]).map((r) => r.reason));
    }),
  );

  // Comments of each post (a reported one is shown only to its author and the manager); the manager also reads why it was reported.
  const commentsOf = new Map<string, FeedComment[]>();
  const commentReasons = new Map<string, string[]>();
  await Promise.all(
    posts.map(async (p) => {
      const { data } = await supabase.rpc("list_feed_comments", { p_post_id: p.id });
      const list = ((data ?? []) as unknown[]).map((x) => commentSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
      commentsOf.set(p.id, list);
      await Promise.all(list.filter((c) => p.can_manage && c.status === "hidden").map(async (c) => {
        const { data: reasons } = await supabase.rpc("list_comment_reports", { p_comment_id: c.id });
        commentReasons.set(c.id, ((reasons ?? []) as { reason: string }[]).map((r) => r.reason));
      }));
    }),
  );

  return (
    <Page width="narrow">
      <PageHero
        eyebrow="Fotos da academia"
        title={`Feed — ${academy.name}`}
        subtitle={`Só os membros desta academia veem estas fotos. Elas somem sozinhas depois de ${FEED_RETENTION_DAYS} dias. Os dados escondidos da foto (como a localização) são removidos antes de salvar.`}
        actions={<ButtonLink href="/medalhas" variant="secondary">Medalhas</ButtonLink>}
      />
      {message && <Alert tone="danger">{message}</Alert>}
      {ok && <Alert tone="success">Foto publicada.</Alert>}

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Postar uma foto</h2>
        <form action="/api/feed/upload" method="post" encType="multipart/form-data">
          <input type="hidden" name="academyId" value={academyId} />
          <input type="hidden" name="clientKey" value={crypto.randomUUID()} />
          <label>Foto (JPEG, PNG ou WebP, até 8 MB) <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <label>Legenda (opcional) <textarea name="caption" rows={2} maxLength={CAPTION_MAX} /></label>
          <label><input type="checkbox" name="hasMinors" /> Há criança ou adolescente na foto (marque quem aparece abaixo)</label>
          <fieldset>
            <legend>Quem aparece na foto (opcional)</legend>
            {people.length === 0 ? <p>Nenhum membro para marcar.</p> : people.map((p) => (
              <label key={p.user_id}>
                <input type="checkbox" name="tagIds" value={p.user_id} disabled={!p.photo_ok} /> {p.person_name}
                {p.is_minor ? (p.photo_ok ? " (menor, com autorização de foto)" : " (menor, sem autorização de foto do responsável: não pode aparecer)") : ""}
              </label>
            ))}
          </fieldset>
          <p><small>Ao postar você confirma que pode compartilhar esta imagem com os membros da academia. Foto de menor só com a autorização do responsável.</small></p>
          <Button type="submit" variant="accent">Publicar</Button>
        </form>
      </Card>

      <section style={{ display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Fotos</h2>
        {posts.length === 0 ? (
          <EmptyState title="Nenhuma foto ainda">Poste a primeira foto do treino.</EmptyState>
        ) : (
          posts.map((p) => (
            <Card key={p.id} className={styles.post}>
              <div className={styles.author}>
                <Avatar name={p.author_name} size="sm" />
                <p><strong>{p.author_name}</strong>{p.mine ? " (você)" : ""} · {fmt(p.created_at)}</p>
              </div>
              {p.status === "hidden" && (
                <p role="note">Oculta para os outros membros: {hiddenReasonLabels[p.hidden_reason ?? ""] ?? "aguarda o gestor"}.</p>
              )}
              {/* Authenticated picture served by our own route; the image optimizer cannot be used for it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/feed/image/${p.id}`} width={p.width} height={p.height} loading="lazy" alt={`Foto postada por ${p.author_name}`} className={styles.photo} />
              {p.caption && <p>{p.caption}</p>}
              {p.can_manage && (
                <p><small>{p.social_ok
                  ? "Redes sociais da academia (Instagram): sem restrição de menores. Confira se não há menor na foto sem marcação."
                  : "NÃO publicar nas redes sociais: há menor marcado sem a autorização do responsável para isso."}</small></p>
              )}
              {p.tags.length > 0 && <p><small>Na foto: {p.tags.map((t) => t.name).join(", ")}</small></p>}
              <p><small>Some em {daysLeft(p.expires_at)} dia(s).</small></p>
              {p.status === "visible" && (
                <form action={toggleReaction.bind(null, academyId)}>
                  <input type="hidden" name="postId" value={p.id} />
                  <Button type="submit" variant={p.reacted_by_me ? "accent" : "secondary"} aria-pressed={p.reacted_by_me}>{p.reacted_by_me ? "Osu! (você reagiu)" : "Osu!"} · {p.reactions}</Button>
                </form>
              )}
              {(commentsOf.get(p.id) ?? []).length > 0 && (
                <ul>
                  {(commentsOf.get(p.id) ?? []).map((c) => (
                    <li key={c.id}>
                      <strong>{c.author_name}</strong>{c.mine ? " (você)" : ""}: {c.body}
                      {c.status === "hidden" && <small> — oculto para os outros: denunciado, aguarda o gestor{(commentReasons.get(c.id) ?? []).length > 0 ? ` (motivo: ${(commentReasons.get(c.id) ?? []).join("; ")})` : ""}</small>}
                      {c.can_manage && c.status === "hidden" && !c.mine && (
                        <form action={restoreComment.bind(null, academyId)}>
                          <input type="hidden" name="commentId" value={c.id} />
                          <button type="submit">Devolver comentário</button>
                        </form>
                      )}
                      {c.can_manage && (
                        <form action={deleteComment.bind(null, academyId)}>
                          <input type="hidden" name="commentId" value={c.id} />
                          <button type="submit">Apagar comentário</button>
                        </form>
                      )}
                      {!c.mine && c.status === "visible" && !c.reported_by_me && (
                        <form action={reportComment.bind(null, academyId)}>
                          <input type="hidden" name="commentId" value={c.id} />
                          <label>Denunciar: motivo <input name="reason" minLength={3} maxLength={300} required /></label>
                          <button type="submit">Denunciar comentário</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {p.status === "visible" && (
                <form action={addComment.bind(null, academyId)}>
                  <input type="hidden" name="postId" value={p.id} />
                  <input type="hidden" name="clientKey" value={crypto.randomUUID()} />
                  <label>Comentar <input name="body" minLength={1} maxLength={COMMENT_MAX} required /></label>
                  <button type="submit">Enviar comentário</button>
                </form>
              )}
              {(reportsOf.get(p.id) ?? []).length > 0 && (
                <ul>{(reportsOf.get(p.id) ?? []).map((r, i) => <li key={i}>Motivo da denúncia: {r}</li>)}</ul>
              )}
              {p.can_manage && p.status === "hidden" && !p.mine && (
                <form action={restorePost.bind(null, academyId)}>
                  <input type="hidden" name="postId" value={p.id} />
                  <button type="submit">Devolver ao feed</button>
                </form>
              )}
              {p.can_manage && (
                <form action={deletePost.bind(null, academyId)}>
                  <input type="hidden" name="postId" value={p.id} />
                  <button type="submit">Apagar esta foto</button>
                </form>
              )}
              {!p.mine && p.status === "visible" && !p.reported_by_me && (
                <form action={reportPost.bind(null, academyId)}>
                  <input type="hidden" name="postId" value={p.id} />
                  <label>Denunciar: motivo <input name="reason" minLength={3} maxLength={300} required /></label>
                  <button type="submit">Denunciar</button>
                </form>
              )}
            </Card>
          ))
        )}
        {posts.length === PAGE && last && <ButtonLink href={`/feed/${academyId}?antes=${encodeURIComponent(last.created_at)}`} variant="secondary">Fotos mais antigas →</ButtonLink>}
      </section>
    </Page>
  );
}
