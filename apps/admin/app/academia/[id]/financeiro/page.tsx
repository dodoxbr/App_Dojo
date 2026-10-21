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
import { getCaller } from "@/lib/context";
import { financeMessage, fmtDate, todayIn } from "@/lib/finance-ui";
import { ChargeActions } from "./charge-actions";
import { generateMonth } from "./actions";

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
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", id).maybeSingle();
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
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 900 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Financeiro — {monthLabel(month)}</h1>
      <p>
        <Link href={`/academia/${id}/financeiro?mes=${shiftMonth(month, -1)}`}>← mês anterior</Link> ·{" "}
        <Link href={`/academia/${id}/financeiro?mes=${shiftMonth(month, 1)}`}>próximo mês →</Link> ·{" "}
        <Link href={`/academia/${id}/financeiro/planos`}>Planos dos alunos</Link>
      </p>
      <p role="note"><small>Controle manual: a plataforma não recebe nem processa pagamentos. Você marca aqui o que recebeu.</small></p>
      {message && <p role="alert">{message}</p>}
      {gerou !== undefined && <p role="status">{Number(gerou) === 0 ? "Nenhuma cobrança nova: o mês já estava gerado ou não há planos ativos." : `${Number(gerou)} cobrança(s) gerada(s).`}</p>}

      {summary.success && (
        <section>
          <h2>Resumo do mês</h2>
          <ul>
            <li>Previsto (abertas + pagas): <strong>{formatCents(summary.data.billed_cents)}</strong> em {summary.data.charges} cobrança(s)</li>
            <li>Recebido: <strong>{formatCents(summary.data.received_cents)}</strong> ({summary.data.paid_count} paga(s))</li>
            <li>Em aberto: <strong>{formatCents(summary.data.open_cents)}</strong></li>
            <li>Atrasado: <strong>{formatCents(summary.data.overdue_cents)}</strong> ({summary.data.overdue_count} cobrança(s))</li>
            <li>Isento: {formatCents(summary.data.waived_cents)} · Cancelado: {formatCents(summary.data.cancelled_cents)}</li>
          </ul>
        </section>
      )}

      <section>
        <h2>Gerar as mensalidades do mês</h2>
        <p>Cria uma cobrança para cada aluno com plano ativo. Repetir não duplica.</p>
        <form action={generateMonth.bind(null, id)}>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
          <button type="submit">Gerar cobranças de {monthLabel(month)}</button>
        </form>
      </section>

      <section>
        <h2>Cobranças com vencimento neste mês</h2>
        {charges.length === 0 ? (
          <p>Nenhuma cobrança neste mês.</p>
        ) : (
          <ul>
            {charges.map((c) => (
              <li key={c.id}>
                <strong><Link href={`/academia/${id}/financeiro/alunos/${c.user_id}`}>{c.student_name}</Link></strong> — {chargeTitle(c)} ·{" "}
                {formatCents(c.amount_cents)} · vence {fmtDate(c.due_date)} · <strong>{chargeStatusText(c)}</strong>
                {c.status === "paid" && c.paid_on && ` em ${fmtDate(c.paid_on)} (${paymentMethodLabels[c.paid_method as PaymentMethod] ?? c.paid_method})`}
                {c.status_note ? ` · ${c.status_note}` : ""}
                {c.financial_name ? ` · responsável financeiro: ${c.financial_name}` : ""}
                <ChargeActions academyId={id} chargeId={c.id} status={c.status} today={today} next={here} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
