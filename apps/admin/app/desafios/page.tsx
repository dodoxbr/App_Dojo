import Link from "next/link";
import {
  challengeListItemSchema,
  challengeMetricLabels,
  challengeStateLabels,
  missingParticipants,
  type ChallengeListItem,
} from "@dojo/contracts/challenges";
import { getCaller } from "@/lib/context";
import { joinChallenge, leaveChallenge } from "./actions";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Challenges of the academies where the caller is an approved member. Joining is the person's own choice.
export default async function DesafiosPage() {
  const { supabase, userId } = await getCaller();
  const [{ data: mem }, { data: ageStatus }] = await Promise.all([
    supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved"),
    supabase.rpc("my_age_status"),
  ]);
  const academyIds = (mem ?? []).map((m) => m.academy_id as string);
  const { data: academies } = academyIds.length ? await supabase.from("academies").select("id, name").in("id", academyIds).order("name") : { data: [] };

  const groups = await Promise.all(
    (academies ?? []).map(async (a) => {
      const { data } = await supabase.rpc("list_challenges", { p_academy_id: a.id });
      const items = ((data ?? []) as unknown[]).map((x) => challengeListItemSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
      return { academy: a as { id: string; name: string }, items };
    }),
  );
  const isAdult = ageStatus === "adult";

  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 760 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Desafios</h1>
      <p>
        Desafios entre os alunos da academia. Participar é uma escolha sua e você pode sair quando quiser. O seu diário não entra nos
        desafios, e o ranking mostra só o nome de exibição e os pontos.
      </p>
      {!isAdult && <p role="note">Só maiores de 18 anos participam de desafios.{ageStatus === "unknown" && <> Informe a data de nascimento no <Link href="/perfil">perfil</Link>.</>}</p>}
      {isAdult && groups.length > 0 && <p><Link href="/desafios/novo">Criar um desafio</Link></p>}
      {groups.length === 0 && <p>Você ainda não faz parte de nenhuma academia.</p>}

      {groups.map(({ academy, items }) => (
        <section key={academy.id}>
          <h2>{academy.name}</h2>
          {items.length === 0 ? <p>Nenhum desafio por aqui ainda.</p> : (
            <ul>
              {items.map((c: ChallengeListItem) => (
                <li key={c.id}>
                  <Link href={`/desafios/${c.id}`}><strong>{c.title}</strong></Link> — {challengeMetricLabels[c.metric]} · {c.points_per_unit} pt cada ·{" "}
                  {fmt(c.starts_on)} a {fmt(c.ends_on)} · <strong>{challengeStateLabels[c.state] ?? c.state}</strong>
                  {c.state === "open" ? ` (${c.participants} de ${c.min_participants}; faltam ${missingParticipants(c)})` : ` · ${c.participants} participantes`}
                  {c.joined && " · você participa"}
                  {isAdult && ["open", "scheduled", "active"].includes(c.state) && (
                    c.joined ? (
                      <form action={leaveChallenge.bind(null, c.id)} style={{ display: "inline", marginLeft: 8 }}><button type="submit">Sair</button></form>
                    ) : (
                      <form action={joinChallenge.bind(null, c.id)} style={{ display: "inline", marginLeft: 8 }}><button type="submit">Participar</button></form>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
