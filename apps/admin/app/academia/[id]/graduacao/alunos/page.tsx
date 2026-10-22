import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ageFlagSchema } from "@dojo/contracts/guardians";
import { milestoneSettingSchema, milestoneStudentSchema } from "@dojo/contracts/milestone";
import { Alert, Avatar, BeltBar, Badge, ButtonLink, DataTable, EmptyState, Page, PageHeader, Section, type DataRow } from "@/components/ui";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { MilestoneSettingForm, RegisterRankForm } from "../forms";
import styles from "./alunos.module.css";

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Students with their current official rank. The manager registers where each person stands today.
export default async function AlunosGraduacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === id);
  const { data: canView } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  const { data: canRecommend } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "recommend_graduation" });
  if (!isManager && canView !== true && canRecommend !== true) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: milestoneRaw } = await supabase.rpc("list_milestone_students", { p_academy_id: id });
  const hasMilestone = await academyHas(supabase, id, "milestone");
  const { data: settingRaw } = await supabase.rpc("get_my_milestone_setting", { p_academy_id: id });
  const setting = milestoneSettingSchema.safeParse(((settingRaw ?? []) as unknown[])[0]);
  const atMilestone = ((milestoneRaw ?? []) as unknown[]).map((x) => milestoneStudentSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const milestoneOf = new Map(atMilestone.map((m) => [m.user_id, m]));

  const { data: members } = await supabase.from("memberships").select("user_id").eq("academy_id", id).eq("status", "approved").eq("role", "student");
  const userIds = (members ?? []).map((m) => m.user_id as string);
  const [{ data: profiles }, { data: ranks }, flagsRes] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    supabase.from("current_ranks").select("user_id, belt_code, degree, effective_date").eq("academy_id", id),
    // Só o gestor lê quem é menor; a data de nascimento nunca aparece.
    isManager ? supabase.rpc("member_age_flags", { p_academy_id: id }) : Promise.resolve({ data: [] }),
  ]);
  const minors = new Set(
    ((flagsRes.data ?? []) as unknown[]).map((x) => ageFlagSchema.safeParse(x)).flatMap((r) => (r.success && r.data.is_minor ? [r.data.user_id] : [])),
  );
  const current = new Map((ranks ?? []).map((r) => [r.user_id as string, r as { belt_code: string; degree: number; effective_date: string }]));
  const people = (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const rows: DataRow[] = people.map((p) => {
    const r = current.get(p.id);
    const m = milestoneOf.get(p.id);
    const tags = [r ? "com-graduacao" : "sem-graduacao", ...(hasMilestone && m ? ["no-numero"] : []), ...(minors.has(p.id) ? ["menor"] : [])];
    return {
      id: p.id,
      search: `${p.name} ${r?.belt_code ?? ""}`,
      tags,
      cells: {
        aluno: (
          <span className={styles.person}>
            <Avatar name={p.name} size="sm" />
            <span>
              <Link href={`/academia/${id}/graduacao/alunos/${p.id}`} className={styles.name}>{p.name}</Link>
              {minors.has(p.id) && <small className={styles.sub}>Menor de idade</small>}
            </span>
          </span>
        ),
        graduacao: r ? (
          <span className={styles.rank}>
            <BeltBar belt={r.belt_code} degree={r.degree} size="sm" />
            <span><strong>{r.belt_code} · grau {r.degree}</strong></span>
          </span>
        ) : isManager ? (
          <RegisterRankForm academyId={id} userId={p.id} />
        ) : (
          <span className={styles.muted}>sem graduação registrada</span>
        ),
        desde: r ? fmtDate(r.effective_date) : "—",
        treinos: hasMilestone && m ? <strong>{m.attendances}</strong> : <span className={styles.muted}>—</span>,
        situacao: !r ? <Badge tone="neutral">Sem graduação</Badge> : hasMilestone && m ? <Badge tone="success">No número de treinos</Badge> : <Badge tone="info">Em andamento</Badge>,
        acoes: <ButtonLink href={`/academia/${id}/graduacao/alunos/${p.id}`} variant="secondary">Abrir</ButtonLink>,
      },
    };
  });

  return (
    <Page>
      <PageHeader
        title="Alunos e graduação atual"
        subtitle="A graduação oficial só é registrada pelo gestor. O aluno não altera a própria graduação."
        actions={<ButtonLink href={`/academia/${id}/graduacao`} variant="secondary">← Graduação</ButtonLink>}
      />
      {hasMilestone && setting.success && (
        <Section
          title="Aviso de treinos"
          hint={`Cada professor decide o seu número. O aluno recebe o aviso quando chega ao número de um dos professores das turmas em que treinou desde a última graduação; você vê os seus alunos${isManager ? " (como gestor, todos os alunos da academia)" : ""}. Sem escolha, o número é 30.`}
        >
          <MilestoneSettingForm academyId={id} threshold={setting.data.threshold} enabled={setting.data.enabled} />
        </Section>
      )}
      {hasMilestone && atMilestone.length > 0 && (
        <Alert tone="success">
          <strong>Chegaram ao seu número de treinos desde a última graduação:</strong>{" "}
          {atMilestone.map((s, i) => (
            <span key={s.user_id}>{i > 0 ? ", " : ""}<Link href={`/academia/${id}/graduacao/alunos/${s.user_id}`}>{s.person_name}</Link> ({s.attendances} treinos)</span>
          ))}
        </Alert>
      )}
      {people.length === 0 ? (
        <EmptyState title="Nenhum aluno aprovado visível">Para ver a lista é preciso a permissão de ver a lista de alunos.</EmptyState>
      ) : (
        <DataTable
          searchLabel="Buscar aluno ou faixa"
          columns={[
            { key: "aluno", label: "Aluno" },
            { key: "graduacao", label: "Graduação atual" },
            { key: "desde", label: "Desde" },
            { key: "treinos", label: "Treinos desde a graduação", align: "center" },
            { key: "situacao", label: "Situação" },
            { key: "acoes", label: "Ações", align: "right" },
          ]}
          rows={rows}
          filters={[
            { value: "sem-graduacao", label: "Sem graduação" },
            ...(hasMilestone ? [{ value: "no-numero", label: "No número de treinos" }] : []),
            ...(isManager ? [{ value: "menor", label: "Menores" }] : []),
          ]}
          emptyText="Nenhum aluno com esse filtro."
        />
      )}
    </Page>
  );
}
