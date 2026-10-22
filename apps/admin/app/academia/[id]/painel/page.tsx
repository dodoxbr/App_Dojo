import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { activationLabels, dashboardSchema, parsePeriod, retentionRate } from "@dojo/contracts/dashboard";
import { FeatureOff } from "@/components/feature-off";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";

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

  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 960 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Painel de frequência e indicadores</h1>
      <nav aria-label="Período">
        Período:{" "}
        {PERIODS.map((p) => (
          p === days ? <strong key={p}>{p} dias </strong> : <span key={p}><Link href={`/academia/${id}/painel?dias=${p}`}>{p} dias</Link>{" "}</span>
        ))}
      </nav>
      <p role="note">
        Medição para acompanhar o piloto: <strong>sem metas</strong>. Só contam presenças <strong>validadas e não revogadas</strong>.
        O diário continua privado: o painel mostra apenas quantos alunos registraram, nunca o conteúdo.
      </p>

      {error || !parsed.success ? (
        <p role="alert">Não foi possível calcular os indicadores.</p>
      ) : (
        <>
          <section>
            <h2>Ativação</h2>
            <ul>
              {Object.entries(parsed.data.activation).map(([status, n]) => <li key={status}>{activationLabels[status] ?? status}: {n}</li>)}
              {Object.keys(parsed.data.activation).length === 0 && <li>Nenhuma filiação ainda.</li>}
            </ul>
          </section>

          <section>
            <h2>Frequência (últimos {parsed.data.period_days} dias)</h2>
            <ul>
              <li>Aulas realizadas: {parsed.data.attendance.sessions_held} (canceladas: {parsed.data.attendance.sessions_cancelled})</li>
              <li>Presenças validadas: {parsed.data.attendance.validated} · aguardando confirmação: {parsed.data.attendance.pending} · revogadas: {parsed.data.attendance.revoked}</li>
              <li>Média de presenças validadas por aula: {num(parsed.data.attendance.avg_validated_per_session)}</li>
              <li>Tempo até o professor confirmar o pedido (mediana): {num(parsed.data.attendance.median_minutes_to_validate, " min")}</li>
            </ul>
            <h3>Por turma</h3>
            {parsed.data.by_class.length === 0 ? <p>Nenhuma turma.</p> : (
              <ul>
                {parsed.data.by_class.map((c) => (
                  <li key={c.class_id}>{c.title}: {c.sessions_held} aulas · {c.validated} presenças validadas · média {num(c.avg_validated_per_session)}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Retenção semanal</h2>
            <p>Entre quem teve presença validada numa semana, quantos voltaram na semana seguinte.</p>
            {parsed.data.retention.every((r) => r.active === 0) ? <p>Ainda sem dados suficientes.</p> : (
              <ul>
                {parsed.data.retention.filter((r) => r.active > 0).map((r) => (
                  <li key={r.week_start}>Semana de {fmtDate(r.week_start)}: {r.active} ativos · {r.retained_next_week} voltaram ({num(retentionRate(r), "%")})</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Diário e técnicas mais consultadas</h2>
            {!parsed.data.privacy.enough_members ? (
              <p role="status">
                Para proteger a privacidade, estes indicadores só aparecem quando a academia tem pelo menos {parsed.data.privacy.min_group_size} alunos
                aprovados (hoje: {parsed.data.privacy.students}).
              </p>
            ) : (
              <>
                {parsed.data.diary && (
                  <p>Diário: {parsed.data.diary.with_entry_last_7_days} de {parsed.data.diary.students} alunos registraram treino nos últimos 7 dias ({num(parsed.data.diary.percent, "%")}).</p>
                )}
                {parsed.data.techniques && (
                  <>
                    <h3>Técnicas mais consultadas ({parsed.data.techniques.total_views} consultas)</h3>
                    <p><small>Contagem agregada por dia: não guarda quem consultou.</small></p>
                    {parsed.data.techniques.top.length === 0 ? <p>Ainda sem consultas.</p> : (
                      <ol>
                        {parsed.data.techniques.top.map((t) => (
                          <li key={t.technique_id}><Link href={`/tecnicas/${t.technique_id}`}>{t.name}</Link> — {t.category}: {t.views}</li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Alunos com recomendação de graduação</h2>
        <p>Lista calculada pelas regras da academia. É uma recomendação: a promoção é decisão do gestor.</p>
        {eligibleRows.length === 0 ? <p>Nenhum aluno elegível agora.</p> : (
          <ul>
            {eligibleRows.map((e) => (
              <li key={e.user_id}>
                <Link href={`/academia/${id}/graduacao/alunos/${e.user_id}`}>{nameOf.get(e.user_id) ?? "Aluno"}</Link> — {e.belt_code} · grau {e.degree} (regra v{e.rule_version})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
