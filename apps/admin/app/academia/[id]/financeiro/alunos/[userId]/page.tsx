import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  chargeEventLabels,
  chargeStatusText,
  chargeTitle,
  formatCents,
  paymentMethodLabels,
  studentFinanceSchema,
  type PaymentMethod,
} from "@dojo/contracts/finance";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { financeMessage, fmtDate, todayIn } from "@/lib/finance-ui";
import { ChargeActions } from "../../charge-actions";
import { createCharge } from "../../actions";

// All the finance of one student: plan, charges (with the buttons), a one-off charge and the history of changes.
export default async function FinanceiroAlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; userId: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id, userId } = await params;
  const { erro, ok } = await searchParams;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(userId).success) notFound();
  const { supabase, managedAcademies } = await getCaller();
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const today = todayIn((academy.timezone as string) ?? "America/Sao_Paulo");
  const { data, error } = await supabase.rpc("student_finance", { p_academy_id: id, p_user_id: userId });
  const parsed = studentFinanceSchema.safeParse(data);
  if (error || !parsed.success) notFound();
  const f = parsed.data;
  const here = `/academia/${id}/financeiro/alunos/${userId}`;
  const message = financeMessage(erro);
  const titleOf = new Map(f.charges.map((c) => [c.id, chargeTitle(c)]));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 800 }}>
      <p><Link href={`/academia/${id}/financeiro`}>← Financeiro de {academy.name}</Link></p>
      <h1>Financeiro de {f.name ?? "aluno"}</h1>
      {message && <p role="alert">{message}</p>}
      {ok && <p role="status">Cobrança criada.</p>}
      <p>
        {f.plan ? <>Plano: <strong>{formatCents(f.plan.amount_cents)}</strong> por mês, vence no dia {f.plan.due_day}, a partir de {fmtDate(f.plan.starts_on)}{f.plan.active ? "" : " (inativo)"}.</> : "Sem plano de mensalidade."}{" "}
        <Link href={`/academia/${id}/financeiro/planos`}>Editar planos</Link>
      </p>
      {f.financial && <p>Responsável pelo pagamento: {f.financial.name} ({f.financial.relationship}{f.financial.kind === "financial" ? ", responsável financeiro" : ", responsável legal"})</p>}

      <section>
        <h2>Cobranças</h2>
        {f.charges.length === 0 ? (
          <p>Nenhuma cobrança ainda.</p>
        ) : (
          <ul>
            {f.charges.map((c) => (
              <li key={c.id}>
                {chargeTitle(c)} · {formatCents(c.amount_cents)} · vence {fmtDate(c.due_date)} · <strong>{chargeStatusText(c)}</strong>
                {c.status === "paid" && c.paid_on && ` em ${fmtDate(c.paid_on)} (${paymentMethodLabels[c.paid_method as PaymentMethod] ?? c.paid_method})`}
                {c.status_note ? ` · ${c.status_note}` : ""}
                <ChargeActions academyId={id} chargeId={c.id} status={c.status} today={today} next={here} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Nova cobrança avulsa</h2>
        <p>Para matrícula, uniforme, exame de faixa ou outro valor fora da mensalidade.</p>
        <form action={createCharge.bind(null, id)}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
          <label>Descrição <input name="description" minLength={2} maxLength={120} required /></label>
          <label>Valor (R$) <input name="amount" inputMode="decimal" required /></label>
          <label>Vencimento <input name="dueDate" type="date" defaultValue={today} required /></label>
          <button type="submit">Criar cobrança</button>
        </form>
      </section>

      <section>
        <h2>Histórico de alterações</h2>
        {f.history.length === 0 ? (
          <p>Sem registros.</p>
        ) : (
          <ul>
            {f.history.map((h, i) => (
              <li key={`${h.charge_id}-${i}`}>
                {new Date(h.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {chargeEventLabels[h.event] ?? h.event} — {titleOf.get(h.charge_id) ?? "cobrança"} · por {h.actor}
                {typeof h.data.reason === "string" ? ` · motivo: ${h.data.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
