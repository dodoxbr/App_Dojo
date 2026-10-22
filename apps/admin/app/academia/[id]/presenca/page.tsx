import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatSessionRange } from "@dojo/contracts/classes";
import { idSchema } from "@dojo/contracts/membership";
import { Avatar, Badge, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, type DataRow } from "@/components/ui";
import { getCaller } from "@/lib/context";
import styles from "./presenca.module.css";

const nowMs = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

type Phase = "andamento" | "proxima" | "concluida" | "cancelada";
const phaseBadge: Record<Phase, { tone: "info" | "success" | "accent" | "neutral"; label: string }> = {
  andamento: { tone: "success", label: "Em andamento" },
  proxima: { tone: "info", label: "Próxima" },
  concluida: { tone: "neutral", label: "Concluída" },
  cancelada: { tone: "neutral", label: "Cancelada" },
};

type SessionRow = { id: string; class_id: string; starts_at: string; ends_at: string; status: string };

// Presença da academia: todas as aulas (30 dias para trás, 14 para frente) com situação, professor e quantas presenças foram
// confirmadas. Só a presença validada pelo professor conta; abrir a aula leva à lista de presença.
export default async function PresencaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === id);
  const { data: canValidate } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "validate_attendance" });
  if (!isManager && canValidate !== true) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const tz = (academy.timezone as string) ?? "America/Sao_Paulo";
  const now = nowMs();

  const { data: sessionsRaw } = await supabase
    .from("sessions")
    .select("id, class_id, starts_at, ends_at, status")
    .eq("academy_id", id)
    .gte("starts_at", new Date(now - 30 * DAY).toISOString())
    .lte("starts_at", new Date(now + 14 * DAY).toISOString())
    .order("starts_at", { ascending: false })
    .limit(200);
  const sessions = (sessionsRaw ?? []) as SessionRow[];
  const sessionIds = sessions.map((s) => s.id);
  const classIds = [...new Set(sessions.map((s) => s.class_id))];

  const [{ data: classes }, { data: attendances }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, title, instructor_user_id").in("id", classIds) : Promise.resolve({ data: [] }),
    sessionIds.length ? supabase.from("attendances").select("session_id, status").in("session_id", sessionIds) : Promise.resolve({ data: [] }),
  ]);
  const instructorIds = [...new Set((classes ?? []).map((c) => c.instructor_user_id as string).filter(Boolean))];
  const { data: people } = instructorIds.length ? await supabase.from("profiles").select("id, display_name").in("id", instructorIds) : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const classOf = new Map((classes ?? []).map((c) => [c.id as string, c as { title: string; instructor_user_id: string }]));

  const counts = new Map<string, { validated: number; pending: number }>();
  for (const a of attendances ?? []) {
    const c = counts.get(a.session_id as string) ?? { validated: 0, pending: 0 };
    if (a.status === "validated") c.validated += 1;
    else if (a.status === "pending") c.pending += 1;
    counts.set(a.session_id as string, c);
  }

  const phaseOf = (s: SessionRow): Phase => {
    if (s.status === "cancelled") return "cancelada";
    if (Date.parse(s.starts_at) > now) return "proxima";
    return Date.parse(s.ends_at) >= now ? "andamento" : "concluida";
  };

  const rows: DataRow[] = sessions.map((s) => {
    const phase = phaseOf(s);
    const cls = classOf.get(s.class_id);
    const instructor = nameOf.get(cls?.instructor_user_id ?? "") ?? "—";
    const c = counts.get(s.id) ?? { validated: 0, pending: 0 };
    const b = phaseBadge[phase];
    return {
      id: s.id,
      search: `${cls?.title ?? ""} ${instructor}`,
      tags: [phase, ...(c.pending > 0 ? ["a-confirmar"] : [])],
      cells: {
        aula: <strong>{cls?.title ?? "Aula"}</strong>,
        professor: <span className={styles.person}><Avatar name={instructor} size="sm" /><span>{instructor}</span></span>,
        quando: formatSessionRange(s.starts_at, s.ends_at, tz),
        situacao: <Badge tone={b.tone}>{b.label}</Badge>,
        presencas: (
          <span className={styles.counts}>
            <strong className={c.validated > 0 ? styles.ok : ""}>{c.validated}</strong> confirmadas
            {c.pending > 0 && <Badge tone="info">{c.pending} a confirmar</Badge>}
          </span>
        ),
        acoes: <ButtonLink href={`/turmas/${s.class_id}/aulas/${s.id}`} variant="secondary">{phase === "andamento" || c.pending > 0 ? "Validar" : "Abrir"}</ButtonLink>,
      },
    };
  });

  const phases = sessions.map((s) => ({ s, p: phaseOf(s) }));
  const totalWeek = phases.filter(({ s }) => Date.parse(s.starts_at) <= now && Date.parse(s.starts_at) >= now - 7 * DAY && s.status !== "cancelled").length;
  const live = phases.filter(({ p }) => p === "andamento").length;
  const next7 = phases.filter(({ s, p }) => p === "proxima" && Date.parse(s.starts_at) <= now + 7 * DAY).length;
  const done7 = phases.filter(({ s, p }) => p === "concluida" && Date.parse(s.starts_at) >= now - 7 * DAY).length;
  const toConfirm = [...counts.values()].reduce((sum, c) => sum + c.pending, 0);

  return (
    <Page>
      <PageHeader
        title="Presença"
        subtitle="Acompanhe as aulas e confirme a presença dos alunos. Só a presença confirmada pelo professor conta."
        actions={<ButtonLink href={`/academia/${id}/turmas`} variant="secondary">Turmas e aulas</ButtonLink>}
      />
      <div className={styles.kpis}>
        <Card className={styles.kpi}><span className={styles.kpiLabel}>Aulas nos últimos 7 dias</span><strong className={styles.kpiValue}>{totalWeek}</strong></Card>
        <Card className={styles.kpi}><span className={styles.kpiLabel}>Em andamento agora</span><strong className={styles.kpiValue}>{live}</strong></Card>
        <Card className={styles.kpi}><span className={styles.kpiLabel}>Próximas (7 dias)</span><strong className={styles.kpiValue}>{next7}</strong></Card>
        <Card className={styles.kpi}><span className={styles.kpiLabel}>Concluídas (7 dias)</span><strong className={styles.kpiValue}>{done7}</strong></Card>
        <Card className={`${styles.kpi} ${toConfirm > 0 ? styles.attention : ""}`}><span className={styles.kpiLabel}>Presenças a confirmar</span><strong className={styles.kpiValue}>{toConfirm}</strong></Card>
      </div>
      <h2 className={styles.h2}>Listagem de aulas</h2>
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma aula neste período" action={<ButtonLink href={`/academia/${id}/turmas`} variant="secondary">Agendar uma aula</ButtonLink>}>
          Aparecem aqui as aulas dos últimos 30 dias e dos próximos 14. <Link href={`/academia/${id}/turmas`}>Crie turmas e aulas</Link> para começar.
        </EmptyState>
      ) : (
        <DataTable
          searchLabel="Buscar aula ou professor"
          columns={[
            { key: "aula", label: "Aula" },
            { key: "professor", label: "Professor" },
            { key: "quando", label: "Data e hora" },
            { key: "situacao", label: "Situação" },
            { key: "presencas", label: "Presenças" },
            { key: "acoes", label: "Ações", align: "right" },
          ]}
          rows={rows}
          filters={[
            { value: "andamento", label: "Em andamento" },
            { value: "proxima", label: "Próximas" },
            { value: "concluida", label: "Concluídas" },
            { value: "cancelada", label: "Canceladas" },
            { value: "a-confirmar", label: "Com presença a confirmar" },
          ]}
          emptyText="Nenhuma aula com esse filtro."
        />
      )}
    </Page>
  );
}
