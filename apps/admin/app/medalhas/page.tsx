import Link from "next/link";
import { academyMedalSchema, medalSchema, type Medal } from "@dojo/contracts/feed";
import { getCaller } from "@/lib/context";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Medals are computed by the database from validated, non-revoked attendance (US-019); nothing here is typed in by a person.
export default async function MedalhasPage() {
  const { supabase, userId } = await getCaller();
  const { data: mine } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const ids = (mine ?? []).map((m) => m.academy_id as string);
  const { data: academies } = ids.length ? await supabase.from("academies").select("id, name").in("id", ids).order("name") : { data: [] as { id: string; name: string }[] };

  const blocks = await Promise.all((academies ?? []).map(async (a) => {
    const [{ data: own }, { data: board }] = await Promise.all([
      supabase.rpc("my_medals", { p_academy_id: a.id }),
      supabase.rpc("list_academy_medals", { p_academy_id: a.id }),
    ]);
    const ownMedals: Medal[] = ((own ?? []) as unknown[]).map((x) => medalSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
    const people = new Map<string, { name: string; medals: Medal[] }>();
    for (const row of ((board ?? []) as unknown[]).map((x) => academyMedalSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []))) {
      if (row.user_id === userId) continue;
      const entry = people.get(row.user_id) ?? { name: row.person_name, medals: [] };
      entry.medals.push(row);
      people.set(row.user_id, entry);
    }
    return { academy: a, ownMedals, people: [...people.values()] };
  }));

  return (
    <main style={{ padding: 16, display: "grid", gap: 20, maxWidth: 640 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Medalhas</h1>
      <p role="note"><small>As medalhas vêm só do que já foi confirmado pelo professor (presenças validadas) e dos desafios de presença encerrados. São um símbolo dentro do app, sem valor em dinheiro. Se uma presença for revogada, a medalha que dependia dela deixa de valer. Os critérios atuais são valores de teste.</small></p>
      {blocks.length === 0 && <p>As medalhas aparecem para quem faz parte de uma academia.</p>}
      {blocks.map(({ academy, ownMedals, people }) => (
        <section key={academy.id as string}>
          <h2>{academy.name as string}</h2>
          <h3>Minhas medalhas</h3>
          {ownMedals.length === 0 ? <p>Ainda não há medalhas. Elas aparecem conforme suas presenças são confirmadas.</p> : (
            <ul>{ownMedals.map((m) => <li key={`${m.code}-${m.challenge_id ?? ""}`}>{m.title} — {fmtDate(m.earned_on)}</li>)}</ul>
          )}
          <h3>Quadro da academia (adultos)</h3>
          {people.length === 0 ? <p>Ninguém mais tem medalhas ainda.</p> : (
            <ul>{people.map((p) => <li key={p.name}><strong>{p.name}</strong>: {p.medals.map((m) => m.title).join("; ")}</li>)}</ul>
          )}
        </section>
      ))}
    </main>
  );
}
