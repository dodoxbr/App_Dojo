import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  chargeRowSchema,
  chargeStatusText,
  chargeTitle,
  formatCents,
  monthLabel,
  monthParamSchema,
  monthStart,
  paymentMethodLabels,
  shiftMonth,
  summarySchema,
  type PaymentMethod,
} from "@dojo/contracts/finance";
import { FeatureOff } from "@/components/feature-off";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Page, PageHeader, Section } from "@/components/ui";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { financeMessage, fmtDate, todayIn } from "@/lib/finance-ui";
import { ChargeActions } from "./charge-actions";
import { generateMonth, setAutoCharges } from "./actions";
import styles from "./financeiro.module.css";

// Monthly view of the manager: summary, charges of the month and the buttons to mark them by hand.
export default async function FinanceiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; erro?: string; gerou?: string }>;
}) {
  const { id } = await params;
  const { mes, erro, gerou } = await searchParams;
  const { supabase, managedAcademies } = await getCaller();
  if (!(await academyHas(supabase, id, "finance"))) return <FeatureOff feature="finance" />;
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, timezone, auto_charges").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const today = todayIn((academy.timezone as string) ?? "America/Sao_Paulo");
  const month = mes && monthParamSchema.safeParse(mes).success ? mes : today.slice(0, 7);

  const [{ data: summaryRaw }, { data: chargesRaw }] = await Promise.all([
    supabase.rpc("finance_summary", { p_academy_id: id, p_month: monthStart(month) }),
    supabase.rpc("list_academy_charges", { p_academy_id: id, p_month: monthStart(month) }),
  ]);
  const summary = summarySchema.safeParse(((summaryRaw ?? []) as unknown[])[0]);
  const charges = ((chargesRaw ?? []) as unknown[]).map((x) => chargeRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const message = financeMessage(erro);
  const here = `/academia/${id}/financeiro?mes=${month}`;

  return (
    <Page>
      <PageHeader
        title={`Financeiro — ${monthLabel(month)}`}
        subtitle={academy.name}
        actions={
          <>
            <ButtonLink href={`/academia/${id}/financeiro?mes=${shiftMonth(month, -1)}`} variant="secondary">← mês anterior</ButtonLink>
            <ButtonLink href={`/academia/${id}/financeiro?mes=${shiftMonth(month, 1)}`} variant="secondary">próximo mês →</ButtonLink>
            <ButtonLink href={`/academia/${id}/financeiro/planos`} variant="secondary">Planos dos alunos</ButtonLink>
          </>
        }
      />
      <Alert tone="info">Controle manual: a plataforma não recebe nem processa pagamentos. Você marca aqui o que recebeu.</Alert>
      {message && <Alert tone="danger">{message}</Alert>}
      {gerou !== undefined && <Alert tone="success">{Number(gerou) === 0 ? "Nenhuma cobrança nova: o mês já estava gerado ou não há planos ativos." : `${Number(gerou)} cobrança(s) gerada(s).`}</Alert>}

      {summary.success && (
        <>
          <h2 className={styles.h2}>Resumo do mês</h2>
          <div className={styles.kpis}>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Previsto (abertas + pagas)</span><strong className={styles.kpiValue}>{formatCents(summary.data.billed_cents)}</strong><span className={styles.kpiHint}>em {summary.data.charges} cobrança(s)</span></Card>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Recebido</span><strong className={styles.kpiValue}>{formatCents(summary.data.received_cents)}</strong><span className={styles.kpiHint}>{summary.data.paid_count} paga(s)</span></Card>
            <Card className={styles.kpi}><span className={styles.kpiLabel}>Em aberto</span><strong className={styles.kpiValue}>{formatCents(summary.data.open_cents)}</strong></Card>
            <Card className={`${styles.kpi} ${styles.late}`}><span className={styles.kpiLabel}>Atrasado</span><strong className={styles.kpiValue}>{formatCents(summary.data.overdue_cents)}</strong><span className={styles.kpiHint}>{summary.data.overdue_count} cobrança(s)</span></Card>
          </div>
          <p className={styles.muted}>Isento: {formatCents(summary.data.waived_cents)} · Cancelado: {formatCents(summary.data.cancelled_cents)}</p>
        </>
      )}

      <Section title="Gerar as mensalidades do mês" hint="Cria uma cobrança para cada aluno com plano ativo. Repetir não duplica.">
        <p>
          Geração automática: <strong>{academy.auto_charges ? "ligada" : "desligada"}</strong>. Quando ligada, o sistema gera sozinho as mensalidades do mês
          corrente (uma conferência por dia, de madrugada) e nunca duplica.
        </p>
        <div className={styles.buttons}>
          <form action={setAutoCharges.bind(null, id)}>
            <input type="hidden" name="enabled" value={academy.auto_charges ? "false" : "true"} />
            <Button type="submit" variant="secondary">{academy.auto_charges ? "Desligar a geração automática" : "Ligar a geração automática"}</Button>
          </form>
          <form action={generateMonth.bind(null, id)}>
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
            <Button type="submit">Gerar cobranças de {monthLabel(month)}</Button>
          </form>
        </div>
      </Section>

      <h2 className={styles.h2}>Cobranças com vencimento neste mês</h2>
      {charges.length === 0 ? (
        <EmptyState title="Nenhuma cobrança neste mês">Gere as mensalidades acima para criar as cobranças dos alunos com plano ativo.</EmptyState>
      ) : (
        <div className={styles.charges}>
          {charges.map((c) => (
            <Card key={c.id} className={styles.charge}>
              <div className={styles.chargeHead}>
                <strong><Link href={`/academia/${id}/financeiro/alunos/${c.user_id}`}>{c.student_name}</Link></strong>
                <Badge tone={c.status === "paid" ? "success" : c.status === "open" && c.overdue ? "danger" : c.status === "open" ? "info" : "neutral"}>{chargeStatusText(c)}</Badge>
                <span className={styles.amount}>{formatCents(c.amount_cents)}</span>
              </div>
              <p className={styles.muted}>
                {chargeTitle(c)} · vence {fmtDate(c.due_date)}
                {c.status === "paid" && c.paid_on && ` · pago em ${fmtDate(c.paid_on)} (${paymentMethodLabels[c.paid_method as PaymentMethod] ?? c.paid_method})`}
                {c.status_note ? ` · ${c.status_note}` : ""}
                {c.financial_name ? ` · responsável financeiro: ${c.financial_name}` : ""}
              </p>
              <ChargeActions academyId={id} chargeId={c.id} status={c.status} today={today} next={here} />
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
