import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { activationLabels, dashboardSchema, parsePeriod, retentionRate } from "@dojo/contracts/dashboard";
import { FeatureOff } from "@/components/feature-off";
import { Alert, Badge, ButtonLink, Card, EmptyState, Page, PageHeader, ProgressBar, Section } from "@/components/ui";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import styles from "./painel.module.css";

const PERIODS = [7, 30, 90];
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const num = (v: number | null, suffix = "") => (v === null ? "—" : `${v.toLocaleString("pt-BR")}${suffix}`);

// Pilot indicators (docs/01). Measurement only: there are no targets here. Only validated attendance counts.
export default async function PainelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { id } = await params;
  const { dias } = await searchParams;
  const days = parsePeriod(dias);
  const { supabase } = await getCaller();
  if (!(await academyHas(supabase, id, "dashboard"))) return <FeatureOff feature="dashboard" />;

  const { data: allowed } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  if (allowed !== true) redirect("/perfil");
  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const [{ data: raw, error }, { data: eligible }] = await Promise.all([
    supabase.rpc("academy_dashboard", { p_academy_id: id, p_days: days }),
    supabase.rpc("eligible_students", { p_academy_id: id }),
  ]);
  const parsed = dashboardSchema.safeParse(raw);

  const eligibleRows = (eligible ?? []) as { user_id: string; belt_code: string; degree: number; rule_version: number }[];
  const ids = eligibleRows.map((e) => e.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
  const data = error || !parsed.success ? null : parsed.data;

  return (
    <Page>
      <PageHeader
        title="Painel de frequência e indicadores"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />
      <nav aria-label="Período" className={styles.period}>
        <span className={styles.periodLabel}>Período:</span>
        {PERIODS.map((p) => (
          p === days
            ? <strong key={p} className={styles.periodOn}>{p} dias</strong>
            : <Link key={p} href={`/academia/${id}/painel?dias=${p}`} className={styles.periodLink}>{p} dias</Link>
        ))}
      </nav>
      <Alert tone="info">
        Medição para acompanhar o piloto: <strong>sem metas</strong>. Só contam presenças <strong>validadas e não revogadas</strong>.
        O diário continua privado: o painel mostra apenas quantos alunos registraram, nunca o conteúdo.
      </Alert>

      {!data ? (
        <Alert tone="danger">Não foi possível calcular os indicadores.</Alert>
      ) : (
        <>
          <div className={styles.kpis}>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Presenças validadas</span><strong className={styles.kpiValue}>{data.attendance.validated}</strong><span className={styles.kpiHint}>aguardando: {data.attendance.pending} · revogadas: {data.attendance.revoked}</span></Card>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Aulas realizadas</span><strong className={styles.kpiValue}>{data.attendance.sessions_held}</strong><span className={styles.kpiHint}>canceladas: {data.attendance.sessions_cancelled}</span></Card>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Média por aula</span><strong className={styles.kpiValue}>{num(data.attendance.avg_validated_per_session)}</strong><span className={styles.kpiHint}>presenças validadas</span></Card>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Confirmação (mediana)</span><strong className={styles.kpiValue}>{num(data.attendance.median_minutes_to_validate, " min")}</strong><span className={styles.kpiHint}>do pedido até o professor</span></Card>
          </div>

          <Section title="Ativação">
            <div className={styles.chips}>
              {Object.entries(data.activation).map(([status, n]) => <Badge key={status} tone="accent">{activationLabels[status] ?? status}: {n}</Badge>)}
              {Object.keys(data.activation).length === 0 && <p className={styles.muted}>Nenhuma filiação ainda.</p>}
            </div>
          </Section>

          <Section title={`Frequência (últimos ${data.period_days} dias)`}>
            <h3 className={styles.h3}>Por turma</h3>
            {data.by_class.length === 0 ? <p className={styles.muted}>Nenhuma turma.</p> : (
              <ul className={styles.rows}>
                {data.by_class.map((c) => (
                  <li key={c.class_id} className={styles.row}>
                    <strong>{c.title}</strong>
                    <span className={styles.muted}>{c.sessions_held} aulas · {c.validated} presenças validadas · média {num(c.avg_validated_per_session)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Retenção semanal" hint="Entre quem teve presença validada numa semana, quantos voltaram na semana seguinte.">
            {data.retention.every((r) => r.active === 0) ? <p className={styles.muted}>Ainda sem dados suficientes.</p> : (
              <ul className={styles.rows}>
                {data.retention.filter((r) => r.active > 0).map((r) => (
                  <li key={r.week_start} className={styles.row}>
                    <span>Semana de {fmtDate(r.week_start)}: {r.active} ativos · {r.retained_next_week} voltaram ({num(retentionRate(r), "%")})</span>
                    <ProgressBar value={r.retained_next_week} max={r.active} label={`Retenção da semana de ${fmtDate(r.week_start)}`} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Diário e técnicas mais consultadas">
            {!data.privacy.enough_members ? (
              <Alert tone="info">
                Para proteger a privacidade, estes indicadores só aparecem quando a academia tem pelo menos {data.privacy.min_group_size} alunos
                aprovados (hoje: {data.privacy.students}).
              </Alert>
            ) : (
              <>
                {data.diary && (
                  <p>Diário: {data.diary.with_entry_last_7_days} de {data.diary.students} alunos registraram treino nos últimos 7 dias ({num(data.diary.percent, "%")}).</p>
                )}
                {data.techniques && (
                  <>
                    <h3 className={styles.h3}>Técnicas mais consultadas ({data.techniques.total_views} consultas)</h3>
                    <p className={styles.muted}>Contagem agregada por dia: não guarda quem consultou.</p>
                    {data.techniques.top.length === 0 ? <p className={styles.muted}>Ainda sem consultas.</p> : (
                      <ol className={styles.rows}>
                        {data.techniques.top.map((t) => (
                          <li key={t.technique_id} className={styles.row}><Link href={`/tecnicas/${t.technique_id}`}>{t.name}</Link><span className={styles.muted}>{t.category}: {t.views}</span></li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </>
            )}
          </Section>
        </>
      )}

      <Section title="Alunos com recomendação de graduação" hint="Lista calculada pelas regras da academia. É uma recomendação: a promoção é decisão do gestor.">
        {eligibleRows.length === 0 ? <EmptyState title="Nenhum aluno elegível agora">Quando alguém cumprir os critérios, aparece aqui.</EmptyState> : (
          <ul className={styles.rows}>
            {eligibleRows.map((e) => (
              <li key={e.user_id} className={styles.row}>
                <Link href={`/academia/${id}/graduacao/alunos/${e.user_id}`}>{nameOf.get(e.user_id) ?? "Aluno"}</Link>
                <span className={styles.muted}>{e.belt_code} · grau {e.degree} (regra v{e.rule_version})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
