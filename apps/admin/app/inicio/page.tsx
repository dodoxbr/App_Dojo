import Link from "next/link";
import { formatSessionRange } from "@dojo/contracts/classes";
import { evaluationSchema } from "@dojo/contracts/graduation";
import { membershipStatusLabels } from "@dojo/contracts/membership";
import { AppShell } from "@/components/shell/AppShell";
import { Alert, Badge, ButtonLink, Card, EmptyState, ProgressBar } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { techniquesByLog } from "@/lib/diary";
import { countInWeek } from "@/lib/week";
import styles from "./inicio.module.css";

// Server-side clock read, kept out of the render body (react-hooks/purity).
const currentTime = () => new Date();

type AcademyRow = { id: string; name: string; timezone: string };

// Home do aluno. Tudo vem de dados reais; nada aqui é exemplo. Só presença VALIDADA conta, e a graduação oficial depende do gestor.
export default async function InicioPage() {
  const { supabase, userId } = await getCaller();
  const now = currentTime();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("academy_id, status").eq("user_id", userId),
  ]);
  const firstName = ((profile?.display_name as string | undefined) ?? "").split(" ")[0] || "atleta";
  const approvedIds = (memberships ?? []).filter((m) => m.status === "approved").map((m) => m.academy_id as string);
  const waiting = (memberships ?? []).filter((m) => m.status !== "approved");
  const allIds = (memberships ?? []).map((m) => m.academy_id as string);
  const { data: academyRows } = allIds.length ? await supabase.from("academies").select("id, name, timezone").in("id", allIds).order("name") : { data: [] };
  const academies = (academyRows ?? []) as AcademyRow[];
  const academyOf = new Map(academies.map((a) => [a.id, a]));
  const primary = academies.find((a) => approvedIds.includes(a.id));

  // Dados da academia principal (a primeira por ordem de nome)
  let rankLabel: string | null = null;
  let criteria: { id: string; label: string; kind: string; current: number | null; target: number | null }[] = [];
  let hasRule = false;
  let weekCount = 0;
  let nextSession: { title: string; range: string } | null = null;
  if (primary) {
    const since = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: rank }, { data: evaluationRaw }, { data: validated }, { data: upcoming }] = await Promise.all([
      supabase.from("current_ranks").select("belt_code, degree").eq("academy_id", primary.id).eq("user_id", userId).maybeSingle(),
      supabase.rpc("evaluate_promotion", { p_academy_id: primary.id, p_user_id: userId }),
      supabase.from("attendances").select("session_id").eq("academy_id", primary.id).eq("user_id", userId).eq("status", "validated"),
      supabase.from("sessions").select("id, class_id, starts_at, ends_at").eq("academy_id", primary.id).eq("status", "scheduled")
        .gte("starts_at", now.toISOString()).order("starts_at").limit(1),
    ]);
    if (rank) rankLabel = `${rank.belt_code as string} · grau ${rank.degree as number}`;
    const evaluation = evaluationSchema.safeParse(evaluationRaw);
    if (evaluation.success && evaluation.data.has_rule) {
      hasRule = true;
      criteria = (evaluation.data.criteria ?? []).filter((c) => c.kind !== "manual");
    }
    const validatedIds = (validated ?? []).map((a) => a.session_id as string);
    if (validatedIds.length) {
      const { data: recent } = await supabase.from("sessions").select("starts_at").in("id", validatedIds).gte("starts_at", since);
      weekCount = countInWeek((recent ?? []).map((s) => s.starts_at as string), now, primary.timezone);
    }
    const next = (upcoming ?? [])[0];
    if (next) {
      const { data: cls } = await supabase.from("classes").select("title").eq("id", next.class_id as string).maybeSingle();
      nextSession = { title: (cls?.title as string | undefined) ?? "Aula", range: formatSessionRange(next.starts_at as string, next.ends_at as string, primary.timezone) };
    }
  }

  const { data: logs } = await supabase.from("training_logs").select("id, trained_at, notes").eq("user_id", userId).order("trained_at", { ascending: false }).limit(3);
  const techniques = await techniquesByLog(supabase, (logs ?? []).map((l) => l.id as string));
  const fmtDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: primary?.timezone ?? "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));

  return (
    <AppShell userName={(profile?.display_name as string | undefined) ?? undefined}>
      <main className={styles.home}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{primary ? primary.name : "Dojo Platform"}</p>
          <h1 className={styles.title}>Olá, {firstName}</h1>
          {primary && (
            <div className={styles.rank}>
              <Badge tone={rankLabel ? "accent" : "neutral"}>{rankLabel ?? "Sem graduação registrada"}</Badge>
            </div>
          )}
        </header>

        {waiting.map((m) => (
          <Alert key={m.academy_id as string} tone="info">
            {academyOf.get(m.academy_id as string)?.name ?? "A academia"}: {membershipStatusLabels[m.status as string] ?? (m.status as string)}.
            {m.status === "pending" ? " Os recursos da academia liberam depois que o gestor aprovar o seu pedido." : ""}
          </Alert>
        ))}

        {!primary ? (
          <EmptyState title="Você ainda não faz parte de uma academia" action={<ButtonLink href="/perfil" variant="secondary">Ver o meu perfil</ButtonLink>}>
            Peça ao gestor da sua academia o link de entrada. Assim que ele aprovar o seu pedido, o seu progresso aparece aqui.
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            <Card className={styles.progress}>
              <h2 className={styles.cardTitle}>Meu progresso</h2>
              {!hasRule || criteria.length === 0 ? (
                <p className={styles.muted}>A sua academia ainda não definiu critérios de graduação medidos em números para o seu nível. Quando definir, o seu avanço aparece aqui.</p>
              ) : (
                <ul className={styles.criteria}>
                  {criteria.map((c) => (
                    <li key={c.id}>
                      <div className={styles.criterionHead}>
                        <span>{c.label}</span>
                        <strong>{c.current ?? 0}{c.kind === "curriculum" ? "%" : ""} de {c.target ?? 0}{c.kind === "curriculum" ? "%" : ""}</strong>
                      </div>
                      <ProgressBar value={c.current ?? 0} max={c.target ?? 1} label={c.label} />
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.note}>Só contam treinos confirmados pelo professor. A graduação só muda com a aprovação do mestre.</p>
              <Link href="/graduacao">Ver a minha evolução</Link>
            </Card>

            <Card>
              <h2 className={styles.cardTitle}>Esta semana</h2>
              <p className={styles.bigNumber}>{weekCount}</p>
              <p className={styles.muted}>{weekCount === 1 ? "treino confirmado" : "treinos confirmados"} (segunda a domingo)</p>
            </Card>

            <Card>
              <h2 className={styles.cardTitle}>Próximo treino</h2>
              {nextSession ? (
                <>
                  <p className={styles.strong}>{nextSession.title}</p>
                  <p className={styles.muted}>{nextSession.range}</p>
                  <ButtonLink href="/aulas" variant="secondary">Ver agenda e check-in</ButtonLink>
                </>
              ) : (
                <p className={styles.muted}>Nenhuma aula agendada por enquanto.</p>
              )}
            </Card>
          </div>
        )}

        <section className={styles.section} aria-labelledby="diario-recente">
          <div className={styles.sectionHead}>
            <h2 id="diario-recente" className={styles.sectionTitle}>Diário recente</h2>
            <ButtonLink href="/diario/novo">Registrar treino</ButtonLink>
          </div>
          {(logs ?? []).length === 0 ? (
            <EmptyState title="Seu diário ainda está vazio">Registre o que treinou hoje. O diário é privado: só você vê.</EmptyState>
          ) : (
            <ul className={styles.logs}>
              {(logs ?? []).map((l) => {
                const names = (techniques.get(l.id as string) ?? []).map((t) => t.name);
                return (
                  <li key={l.id as string}>
                    <Link href={`/diario/${l.id as string}`}>
                      <strong>{fmtDay(l.trained_at as string)}</strong>
                      <span>{names.length ? names.slice(0, 3).join(", ") : ((l.notes as string | null) ?? "Treino registrado")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.shortcuts} aria-label="Atalhos">
          <Link href="/tecnicas" className={styles.shortcut}><strong>Técnicas</strong><span>Catálogo e busca</span></Link>
          <Link href="/trilha" className={styles.shortcut}><strong>Minha trilha</strong><span>O que estudar a seguir</span></Link>
          <Link href="/desafios" className={styles.shortcut}><strong>Desafios</strong><span>Treine com a turma</span></Link>
          <Link href="/medalhas" className={styles.shortcut}><strong>Medalhas</strong><span>Suas conquistas</span></Link>
        </section>
      </main>
    </AppShell>
  );
}
