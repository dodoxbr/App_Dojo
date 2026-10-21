import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { feedMessage } from "@/lib/feed-ui";

export default async function FeedIndexPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, userId } = await getCaller();
  const { data: mine } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const ids = (mine ?? []).map((m) => m.academy_id as string);
  const { data: academies } = ids.length ? await supabase.from("academies").select("id, name").in("id", ids).order("name") : { data: [] as { id: string; name: string }[] };
  if (!erro && (academies ?? []).length === 1) redirect(`/feed/${(academies ?? [])[0]?.id}`);
  const message = feedMessage(erro);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Feed da academia</h1>
      {message && <p role="alert">{message}</p>}
      {(academies ?? []).length === 0 ? (
        <p>O feed fica disponível para quem faz parte de uma academia.</p>
      ) : (
        <ul>
          {(academies ?? []).map((a) => (
            <li key={a.id as string}><Link href={`/feed/${a.id as string}`}>{a.name as string}</Link></li>
          ))}
        </ul>
      )}
    </main>
  );
}
