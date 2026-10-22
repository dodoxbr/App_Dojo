import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatSessionRange } from "@dojo/contracts/classes";
import { idSchema } from "@dojo/contracts/membership";
import { staffMilestoneSchema } from "@dojo/contracts/milestone";
import { AcademyBanner, Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { academyLogoUrl } from "@/lib/academy-logo";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import styles from "./staff.module.css";

// Server-side clock read, kept out of the render body (react-hooks/purity).
const nowIso = () => new Date().toISOString();

// Início de quem trabalha na academia: números do dia, avisos que pedem ação e atalhos. Gestor e instrutor aprovado; o que cada um
// vê é decidido pelo banco (RLS e permissões), esta tela só mostra o que a consulta devolve.
export default async function AcademiaInicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { supabase, userId, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = managedAcademies.some((a) => a.id === id);

  let isInstructor = false;
  if (!isManager) {
    const { data: m } = await supabase.from("memberships").select("role").eq("academy_id", id).eq("user_id", userId).eq("status", "approved").maybeSingle();
    isInstructor = m?.role === "instructor";
  }
  if (!isManager && !isInstructor) redirect(isPlatformAdmin ? "/plataforma" : "/perfil");

  const hasMilestone = await academyHas(supabase, id, "milestone");
  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [students, pendingMembers, pendingAttendances, upcoming, milestonesRaw] = await Promise.all([
    count(supabase.from("memberships").select("id", { count: "exact", head: true }).eq("academy_id", id).eq("status", "approved").eq("role", "student")),
    isManager ? count(supabase.from("memberships").select("id", { count: "exact", head: true }).eq("academy_id", id).eq("status", "pending")) : Promise.resolve(0),
    count(supabase.from("attendances").select("id", { count: "exact", head: true }).eq("academy_id", id).eq("status", "pending")),
    supabase.from("sessions").select("id, class_id, starts_at, ends_at").eq("academy_id", id).eq("status", "scheduled").gte("starts_at", nowIso()).order("starts_at").limit(3),
    supabase.rpc("my_staff_milestones"),
  ]);
  const atMilestone = ((milestonesRaw.data ?? []) as unknown[]).map((x) => staffMilestoneSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []))
    .find((m) => m.academy_id === id)?.students ?? 0;

  const sessions = upcoming.data ?? [];
  const classIds = [...new Set(sessions.map((s) => s.class_id as string))];
  const { data: classes } = classIds.length ? await supabase.from("classes").select("id, title").in("id", classIds) : { data: [] };
  const titleOf = new Map((classes ?? []).map((c) => [c.id as string, c.title as string]));
  const tz = (academy.timezone as string) ?? "America/Sao_Paulo";
  const a = `/academia/${id}`;
  const logoUrl = await academyLogoUrl(supabase, id);

  return (
    <main className={styles.page}>
      <AcademyBanner
        name={academy.name as string}
        logoUrl={logoUrl}
        eyebrow={`${isManager ? "Gestor" : "Instrutor"} · ${new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long" }).format(new Date(nowIso()))}`}
        subtitle="Oss! Aqui estão os números do dia."
      >
        {isManager && <ButtonLink href={`${a}/turmas`} variant="accent">Criar aula</ButtonLink>}
        <ButtonLink href="/aulas" variant="secondary">Validar presença</ButtonLink>
      </AcademyBanner>

      <section className={styles.stats} aria-label="Números da academia">
        <Card className={`${styles.stat} ${styles.tealStat}`}><p className={styles.statLabel}>Alunos ativos</p><p className={styles.statValue}>{students}</p></Card>
        {isManager && (
          <Card className={`${styles.stat} ${styles.amberStat}`}>
            <p className={styles.statLabel}>Pedidos de entrada</p>
            <p className={styles.statValue}>{pendingMembers}</p>
            {pendingMembers > 0 && <Link href={`${a}/membros`}>Revisar</Link>}
          </Card>
        )}
        <Card className={`${styles.stat} ${styles.blueStat}`}>
          <p className={styles.statLabel}>Presenças a confirmar</p>
          <p className={styles.statValue}>{pendingAttendances}</p>
          {pendingAttendances > 0 && <Link href="/aulas">Validar nas aulas</Link>}
        </Card>
        {hasMilestone && <Card className={`${styles.stat} ${styles.purpleStat}`}>
          <p className={styles.statLabel}>No número de treinos</p>
          <p className={styles.statValue}>{atMilestone}</p>
          {atMilestone > 0 && <Link href={`${a}/graduacao/alunos`}>Ver quem são</Link>}
        </Card>}
      </section>

      <section className={styles.section} aria-labelledby="acoes">
        <h2 id="acoes" className={styles.sectionTitle}>Ações rápidas</h2>
        <div className={styles.actions}>
          {isManager && <ButtonLink href={`${a}/turmas`}>Criar aula</ButtonLink>}
          <ButtonLink href="/aulas" variant="secondary">Validar presença</ButtonLink>
          {isManager && <ButtonLink href={`${a}/membros`} variant="secondary">Revisar filiações</ButtonLink>}
          <ButtonLink href={`${a}/graduacao/alunos`} variant="secondary">Alunos e graduação</ButtonLink>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="proximas">
        <h2 id="proximas" className={styles.sectionTitle}>Próximas aulas</h2>
        {sessions.length === 0 ? (
          <EmptyState title="Nenhuma aula agendada" action={isManager ? <ButtonLink href={`${a}/turmas`} variant="secondary">Agendar uma aula</ButtonLink> : undefined}>
            Quando houver aulas, as próximas aparecem aqui para abrir a lista de presença.
          </EmptyState>
        ) : (
          <ul className={styles.sessions}>
            {sessions.map((s) => (
              <li key={s.id as string}>
                <Link href={`/turmas/${s.class_id as string}/aulas/${s.id as string}`}>
                  <strong>{titleOf.get(s.class_id as string) ?? "Aula"}</strong>
                  <span>{formatSessionRange(s.starts_at as string, s.ends_at as string, tz)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isManager && (
        <p className={styles.note}>
          <Badge tone="info">Gestor</Badge> Financeiro, saúde, responsáveis e o resto da gestão estão no menu.
        </p>
      )}
    </main>
  );
}
