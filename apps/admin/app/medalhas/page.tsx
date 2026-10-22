import { academyMedalSchema, medalSchema, type Medal } from "@dojo/contracts/feed";
import { Alert, Avatar, Card, EmptyState, Page, PageHero } from "@/components/ui";
import { getCaller } from "@/lib/context";
import styles from "./medalhas.module.css";

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

  const totalMedals = blocks.reduce((sum, b) => sum + b.ownMedals.length, 0);
  return (
    <Page width="narrow">
      <PageHero
        eyebrow="Conquistas"
        title="Medalhas"
        subtitle="Conquistas calculadas só do que o professor confirmou."
        aside={<span className={styles.count} aria-label={`${totalMedals} medalhas`}><strong>{totalMedals}</strong><small>{totalMedals === 1 ? "medalha" : "medalhas"}</small></span>}
      />
      <Alert tone="info">Vêm das presenças validadas e dos desafios de presença encerrados. São um símbolo dentro do app, sem valor em dinheiro; se uma presença for revogada, a medalha que dependia dela deixa de valer. Os critérios atuais são valores de teste.</Alert>
      {blocks.length === 0 && <EmptyState title="As medalhas aparecem para quem faz parte de uma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState>}
      {blocks.map(({ academy, ownMedals, people }) => (
        <Card key={academy.id as string}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>{academy.name as string}</h2>
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Minhas medalhas</h3>
          {ownMedals.length === 0 ? (
            <EmptyState title="Ainda não há medalhas">Elas aparecem conforme suas presenças são confirmadas.</EmptyState>
          ) : (
            <ul className={styles.medals}>
              {ownMedals.map((m) => (
                <li key={`${m.code}-${m.challenge_id ?? ""}`} className={styles.medal}>
                  <span className={`${styles.disc} ${m.code.startsWith("challenge") ? styles.gold : m.code.startsWith("streak") ? styles.teal : styles.silver}`} aria-hidden="true">★</span>
                  <span className={styles.medalText}><strong>{m.title}</strong><small>{fmtDate(m.earned_on)}</small></span>
                </li>
              ))}
            </ul>
          )}
          <h3 style={{ margin: "24px 0 8px", fontSize: "1rem" }}>Quadro da academia (adultos)</h3>
          {people.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Ninguém mais tem medalhas ainda.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {people.map((p) => (
                <li key={p.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={p.name} size="sm" />
                  <span><strong>{p.name}</strong> <span style={{ color: "var(--text-muted)" }}>· {p.medals.map((m) => m.title).join("; ")}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </Page>
  );
}
