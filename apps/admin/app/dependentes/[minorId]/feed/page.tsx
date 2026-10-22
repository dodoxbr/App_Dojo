import Link from "next/link";
import { notFound } from "next/navigation";
import { daysLeft, dependentPostSchema } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";

const PAGE = 20;

// The legal guardian follows the child's training: only the posts of the feed in which the child appears.
export default async function FeedDoDependentePage({
  params,
  searchParams,
}: {
  params: Promise<{ minorId: string }>;
  searchParams: Promise<{ antes?: string }>;
}) {
  const { minorId } = await params;
  const { antes } = await searchParams;
  if (!idSchema.safeParse(minorId).success) notFound();
  const { supabase } = await getCaller();
  const before = antes && !Number.isNaN(Date.parse(antes)) ? new Date(antes).toISOString() : null;
  const [{ data, error }, { data: deps }] = await Promise.all([
    supabase.rpc("list_dependent_feed", { p_minor_id: minorId, p_before: before, p_limit: PAGE }),
    supabase.rpc("list_my_dependents"),
  ]);
  if (error) notFound();
  const dep = ((deps ?? []) as { minor_user_id: string; minor_name: string; kind: string }[]).find((d) => d.minor_user_id === minorId && d.kind === "legal");
  if (!dep) notFound();
  const posts = ((data ?? []) as unknown[]).map((x) => dependentPostSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  const last = posts[posts.length - 1];

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 960 }}>
      <p><Link href={`/dependentes/${minorId}`}>← {dep.minor_name}</Link></p>
      <h1>Treino de {dep.minor_name}</h1>
      <p role="note"><small>Fotos que os membros da academia postaram e em que {dep.minor_name} aparece, enquanto o seu consentimento de fotos estiver ativo. Elas somem sozinhas depois de 30 dias.</small></p>
      {posts.length === 0 ? (
        <p>Ainda não há fotos com {dep.minor_name}.</p>
      ) : (
        posts.map((p) => (
          <article key={p.id} style={{ borderTop: "1px solid #ccc", paddingTop: 12 }}>
            <p><strong>{p.academy_name}</strong> · postada por {p.author_name} · {fmt(p.created_at)}</p>
            {/* Authenticated picture served by our own route; the image optimizer cannot be used for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/feed/image/${p.id}`} width={p.width} height={p.height} loading="lazy" alt={`Foto do treino de ${dep.minor_name}`} style={{ maxWidth: "100%", height: "auto" }} />
            {p.caption && <p>{p.caption}</p>}
            <p><small>Some em {daysLeft(p.expires_at)} dia(s).</small></p>
          </article>
        ))
      )}
      {posts.length === PAGE && last && <p><Link href={`/dependentes/${minorId}/feed?antes=${encodeURIComponent(last.created_at)}`}>Fotos mais antigas →</Link></p>}
    </main>
  );
}
