import Link from "next/link";
import { redirect } from "next/navigation";
import { formatSessionRange } from "@dojo/contracts/classes";
import { evaluationSchema } from "@dojo/contracts/graduation";
import { membershipStatusLabels } from "@dojo/contracts/membership";
import { trainedDays, weekDays } from "@dojo/contracts/week";
import { AppShell } from "@/components/shell/AppShell";
import { Alert, BeltBar, ButtonLink, Card, EmptyState, Hero, ProgressBar, ProgressRing, WeekStrip } from "@/components/ui";
import { anyAcademyHas, myFeatureMap } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { techniquesByLog } from "@/lib/diary";
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
    supabase.from("memberships").select("academy_id, status, role").eq("user_id", userId),
  ]);
  // Quem trabalha numa academia e não treina nela começa pelo início da equipe; quem faz as duas coisas vê um atalho.
  const staffIds = (memberships ?? []).filter((m) => m.status === "approved" && (m.role === "manager" || m.role === "instructor")).map((m) => m.academy_id as string);
  const isStudent = (memberships ?? []).some((m) => m.status === "approved" && m.role === "student");
  if (staffIds.length > 0 && !isStudent) redirect(`/academia/${staffIds[0]}/inicio`);
  const firstName = ((profile?.display_name as string | undefined) ?? "").split(" ")[0] || "atleta";
  const approvedIds = (memberships ?? []).filter((m) => m.status === "approved").map((m) => m.academy_id as string);
  const waiting = (memberships ?? []).filter((m) => m.status !== "approved");
  const allIds = (memberships ?? []).map((m) => m.academy_id as string);
  const { data: academyRows } = allIds.length ? await supabase.from("academies").select("id, name, timezone").in("id", allIds).order("name") : { data: [] };
  const academies = (academyRows ?? []) as AcademyRow[];
  const academyOf = new Map(academies.map((a) => [a.id, a]));
  const primary = academies.find((a) => approvedIds.includes(a.id));
  const tz = primary?.timezone ?? "America/Sao_Paulo";

  // Dados da academia principal (a primeira por ordem de nome)
  let rank: { belt_code: string; degree: number } | null = null;
  let criteria: { id: string; label: string; kind: string; current: number | null; target: number | null }[] = [];
  let hasRule = false;
  let recentStarts: string[] = [];
  let nextSession: { title: string; range: string } | null = null;
  if (primary) {
    const since = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: rankRow }, { data: evaluationRaw }, { data: validated }, { data: upcoming }] = await Promise.all([
      supabase.from("current_ranks").select("belt_code, degree").eq("academy_id", primary.id).eq("user_id", userId).maybeSingle(),
      supabase.rpc("evaluate_promotion", { p_academy_id: primary.id, p_user_id: userId }),
      supabase.from("attendances").select("session_id").eq("academy_id", primary.id).eq("user_id", userId).eq("status", "validated"),
      supabase.from("sessions").select("id, class_id, starts_at, ends_at").eq("academy_id", primary.id).eq("status", "scheduled")
        .gte("starts_at", now.toISOString()).order("starts_at").limit(1),
    ]);
    if (rankRow) rank = { belt_code: rankRow.belt_code as string, degree: rankRow.degree as number };
    const evaluation = evaluationSchema.safeParse(evaluationRaw);
    if (evaluation.success && evaluation.data.has_rule) {
      hasRule = true;
      criteria = (evaluation.data.criteria ?? []).filter((c) => c.kind !== "manual");
    }
    const validatedIds = (validated ?? []).map((a) => a.session_id as string);
    if (validatedIds.length) {
      const { data: recent } = await supabase.from("sessions").select("starts_at").in("id", validatedIds).gte("starts_at", since);
      recentStarts = (recent ?? []).map((s) => s.starts_at as string);
    }
    const next = (upcoming ?? [])[0];
    if (next) {
      const { data: cls } = await supabase.from("classes").select("title").eq("id", next.class_id as string).maybeSingle();
      nextSession = { title: (cls?.title as string | undefined) ?? "Aula", range: formatSessionRange(next.starts_at as string, next.ends_at as string, primary.timezone) };
    }
  }

  const features = await myFeatureMap(supabase);
  const has = (f: "challenges" | "medals" | "curriculum") => features.size === 0 || anyAcademyHas(features, f);
  const days = weekDays(now, tz);
  const trained = trainedDays(recentStarts, tz);
  const weekCount = days.filter((d) => trained.has(d.date)).length;
  // Percentual geral: média de quanto cada critério numérico já foi atendido (só para o anel; o detalhe está logo abaixo).
  const measurable = criteria.filter((c) => (c.target ?? 0) > 0);
  const overall = measurable.length ? (measurable.reduce((sum, c) => sum + Math.min((c.current ?? 0) / (c.target as number), 1), 0) / measurable.length) * 100 : null;

  const { data: logs } = await supabase.from("training_logs").select("id, trained_at, notes").eq("user_id", userId).order("trained_at", { ascending: false }).limit(3);
  const techniques = await techniquesByLog(supabase, (logs ?? []).map((l) => l.id as string));
  const fmtDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(new Date(iso));

  return (
    <AppShell userName={(profile?.display_name as string | undefined) ?? undefined}>
      <main className={styles.home}>
        <Hero>
          <div className={styles.heroTop}>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>{primary ? primary.name : "Oss"}</p>
              <h1 className={styles.title}>Oss, {firstName}!</h1>
              {primary && (
                <p className={styles.rankLine}>{rank ? `${rank.belt_code} · grau ${rank.degree}` : "Sem graduação registrada"}</p>
              )}
            </div>
            {overall !== null && <ProgressRing percent={overall} label="Progresso geral nos critérios de graduação" size={112} />}
          </div>
          {primary && rank && <BeltBar belt={rank.belt_code} degree={rank.degree} size="lg" />}
          <div className={styles.heroActions}>
            <ButtonLink href="/diario/novo" variant="accent">Registrar treino</ButtonLink>
            {primary && <ButtonLink href="/aulas" variant="secondary">Agenda e check-in</ButtonLink>}
          </div>
          {primary && <p className={styles.heroNote}>Só contam treinos confirmados pelo professor. A graduação só muda com a aprovação do mestre.</p>}
        </Hero>

        {staffIds.length > 0 && (
          <Alert tone="info">
            Você também trabalha na equipe: <Link href={`/academia/${staffIds[0]}/inicio`}>abrir o início da equipe</Link>.
          </Alert>
        )}

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
            <Card className={styles.week}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Esta semana</h2>
                <p className={styles.count}><strong>{weekCount}</strong> {weekCount === 1 ? "treino confirmado" : "treinos confirmados"}</p>
              </div>
              <WeekStrip days={days} trained={trained} />
              <p className={styles.muted}>Segunda a domingo. Um dia marcado quer dizer que o professor confirmou a sua presença.</p>
            </Card>

            <Card className={styles.next}>
              <h2 className={styles.cardTitle}>Próximo treino</h2>
              {nextSession ? (
                <>
                  <p className={styles.strong}>{nextSession.title}</p>
                  <p className={styles.muted}>{nextSession.range}</p>
                </>
              ) : (
                <p className={styles.muted}>Nenhuma aula agendada por enquanto.</p>
              )}
              <ButtonLink href="/aulas" variant="secondary">Ver agenda e check-in</ButtonLink>
            </Card>

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
              <Link href="/graduacao" className={styles.more}>Ver a minha evolução →</Link>
            </Card>
          </div>
        )}

        <section className={styles.section} aria-labelledby="diario-recente">
          <div className={styles.sectionHead}>
            <h2 id="diario-recente" className={styles.sectionTitle}>Diário recente</h2>
            <ButtonLink href="/diario" variant="secondary">Ver tudo</ButtonLink>
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
          {has("curriculum") && <Link href="/trilha" className={styles.shortcut}><strong>Minha trilha</strong><span>O que estudar a seguir</span></Link>}
          {has("challenges") && <Link href="/desafios" className={styles.shortcut}><strong>Desafios</strong><span>Treine com a turma</span></Link>}
          {has("medals") && <Link href="/medalhas" className={styles.shortcut}><strong>Medalhas</strong><span>Suas conquistas</span></Link>}
        </section>
      </main>
    </AppShell>
  );
}
