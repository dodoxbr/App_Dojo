import Link from "next/link";
import { notFound } from "next/navigation";
import { CAPTION_MAX, daysLeft, FEED_RETENTION_DAYS, feedPersonSchema, feedPostSchema, hiddenReasonLabels } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { feedMessage } from "@/lib/feed-ui";
import { deletePost, reportPost, restorePost } from "./actions";

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

  return (
    <main style={{ padding: 16, display: "grid", gap: 20, maxWidth: 720 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Feed — {academy.name}</h1>
      <p role="note"><small>Só os membros desta academia veem estas fotos. Elas somem sozinhas depois de {FEED_RETENTION_DAYS} dias. Os dados escondidos da foto (como a localização) são removidos antes de salvar.</small></p>
      {message && <p role="alert">{message}</p>}
      {ok && <p role="status">Foto publicada.</p>}

      <section>
        <h2>Postar uma foto</h2>
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
          <button type="submit">Publicar</button>
        </form>
      </section>

      <section>
        <h2>Fotos</h2>
        {posts.length === 0 ? (
          <p>Nenhuma foto ainda.</p>
        ) : (
          posts.map((p) => (
            <article key={p.id} style={{ borderTop: "1px solid #ccc", paddingTop: 12, marginTop: 12 }}>
              <p><strong>{p.author_name}</strong>{p.mine ? " (você)" : ""} · {fmt(p.created_at)}</p>
              {p.status === "hidden" && (
                <p role="note">Oculta para os outros membros: {hiddenReasonLabels[p.hidden_reason ?? ""] ?? "aguarda o gestor"}.</p>
              )}
              {/* Authenticated picture served by our own route; the image optimizer cannot be used for it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/feed/image/${p.id}`} width={p.width} height={p.height} loading="lazy" alt={`Foto postada por ${p.author_name}`} style={{ maxWidth: "100%", height: "auto" }} />
              {p.caption && <p>{p.caption}</p>}
              {p.tags.length > 0 && <p><small>Na foto: {p.tags.map((t) => t.name).join(", ")}</small></p>}
              <p><small>Some em {daysLeft(p.expires_at)} dia(s).</small></p>
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
            </article>
          ))
        )}
        {posts.length === PAGE && last && <p><Link href={`/feed/${academyId}?antes=${encodeURIComponent(last.created_at)}`}>Fotos mais antigas →</Link></p>}
      </section>
    </main>
  );
}
