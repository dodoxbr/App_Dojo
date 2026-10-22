import Link from "next/link";
import {
  challengeListItemSchema,
  challengeMetricLabels,
  challengeStateLabels,
  missingParticipants,
  type ChallengeListItem,
} from "@dojo/contracts/challenges";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Page, PageHero, ProgressBar } from "@/components/ui";
import styles from "./desafios.module.css";
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
    <Page width="narrow">
      <PageHero
        eyebrow="Treine com a turma"
        title="Desafios"
        subtitle="Desafios entre os alunos da academia. Participar é uma escolha sua e você pode sair quando quiser. O seu diário não entra nos desafios, e o ranking mostra só o nome de exibição e os pontos."
        actions={isAdult && groups.length > 0 ? <ButtonLink href="/desafios/novo" variant="accent">Criar um desafio</ButtonLink> : undefined}
      />
      {!isAdult && <Alert tone="info">Só maiores de 18 anos participam de desafios.{ageStatus === "unknown" && <> Informe a data de nascimento no <Link href="/perfil">perfil</Link>.</>}</Alert>}
      {groups.length === 0 && <EmptyState title="Você ainda não faz parte de nenhuma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState>}

      {groups.map(({ academy, items }) => (
        <section key={academy.id} style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{academy.name}</h2>
          {items.length === 0 ? <EmptyState title="Nenhum desafio por aqui ainda" /> : items.map((c: ChallengeListItem) => (
            <Card key={c.id} className={`${styles.challenge} ${c.state === "active" ? styles.active : ""}`}>
              <div className={styles.head}>
                <Link href={`/desafios/${c.id}`} className={styles.title}>{c.title}</Link>
                <Badge tone={c.state === "active" ? "success" : c.state === "open" ? "info" : "neutral"}>{challengeStateLabels[c.state] ?? c.state}</Badge>
              </div>
              <p className={styles.meta}>{challengeMetricLabels[c.metric]} · {c.points_per_unit} pt cada · {fmt(c.starts_on)} a {fmt(c.ends_on)}</p>
              {c.state === "open" ? (
                <>
                  <ProgressBar value={c.participants} max={c.min_participants} label="Participantes até o mínimo para começar" />
                  <p className={styles.meta}>{c.participants} de {c.min_participants} participantes; faltam {missingParticipants(c)} para começar.</p>
                </>
              ) : (
                <p className={styles.meta}>{c.participants} participantes</p>
              )}
              <div className={styles.actions}>
                {c.joined && <Badge tone="accent">você participa</Badge>}
                {isAdult && ["open", "scheduled", "active"].includes(c.state) && (
                  c.joined ? (
                    <form action={leaveChallenge.bind(null, c.id)}><Button type="submit" variant="secondary">Sair do desafio</Button></form>
                  ) : (
                    <form action={joinChallenge.bind(null, c.id)}><Button type="submit">Participar</Button></form>
                  )
                )}
                <ButtonLink href={`/desafios/${c.id}`} variant="ghost">Ver o ranking</ButtonLink>
              </div>
            </Card>
          ))}
        </section>
      ))}
    </Page>
  );
}
