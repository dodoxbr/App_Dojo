import { academyMedalSchema, medalSchema, type Medal } from "@dojo/contracts/feed";
import { Badge, Card, EmptyState, Page, PageHeader } from "@/components/ui";
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
    <Page width="narrow">
      <PageHeader
        title="Medalhas"
        subtitle="As medalhas vêm só do que já foi confirmado pelo professor (presenças validadas) e dos desafios de presença encerrados. São um símbolo dentro do app, sem valor em dinheiro. Se uma presença for revogada, a medalha que dependia dela deixa de valer. Os critérios atuais são valores de teste."
      />
      {blocks.length === 0 && <EmptyState title="As medalhas aparecem para quem faz parte de uma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState>}
      {blocks.map(({ academy, ownMedals, people }) => (
        <Card key={academy.id as string}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>{academy.name as string}</h2>
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Minhas medalhas</h3>
          {ownMedals.length === 0 ? (
            <EmptyState title="Ainda não há medalhas">Elas aparecem conforme suas presenças são confirmadas.</EmptyState>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {ownMedals.map((m) => (
                <li key={`${m.code}-${m.challenge_id ?? ""}`}>
                  <Badge tone="accent">{m.title}</Badge> <small>{fmtDate(m.earned_on)}</small>
                </li>
              ))}
            </ul>
          )}
          <h3 style={{ margin: "24px 0 8px", fontSize: "1rem" }}>Quadro da academia (adultos)</h3>
          {people.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Ninguém mais tem medalhas ainda.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {people.map((p) => (
                <li key={p.name}><strong>{p.name}</strong>: {p.medals.map((m) => m.title).join("; ")}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </Page>
  );
}
