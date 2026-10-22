import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCents, planRowSchema } from "@dojo/contracts/finance";
import { FeatureOff } from "@/components/feature-off";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { financeMessage, todayIn } from "@/lib/finance-ui";
import { setPlan } from "../actions";

// One plan per student: the academy chooses the value and the due day (there is no default value).
export default async function PlanosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { supabase, managedAcademies } = await getCaller();
  if (!(await academyHas(supabase, id, "finance"))) return <FeatureOff feature="finance" />;
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, timezone").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const today = todayIn((academy.timezone as string) ?? "America/Sao_Paulo");
  const { data: raw } = await supabase.rpc("list_member_plans", { p_academy_id: id });
  const rows = ((raw ?? []) as unknown[]).map((x) => planRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const message = financeMessage(erro);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 960 }}>
      <p><Link href={`/academia/${id}/financeiro`}>← Financeiro</Link></p>
      <h1>Planos dos alunos</h1>
      <p>Defina o valor da mensalidade e o dia de vencimento de cada aluno. Só alunos com plano <strong>ativo</strong> recebem cobrança ao gerar o mês.</p>
      {message && <p role="alert">{message}</p>}
      {ok && <p role="status">Plano salvo.</p>}
      {rows.length === 0 ? (
        <p>Nenhum aluno aprovado ainda.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.user_id}>
              <form action={setPlan.bind(null, id)}>
                <strong>{r.student_name}</strong>
                {r.is_minor ? ` (menor${r.financial_name ? ` · responsável financeiro: ${r.financial_name}` : ""})` : ""}
                {r.amount_cents ? ` — hoje: ${formatCents(r.amount_cents)}${r.discount_cents ? ` com desconto de ${formatCents(r.discount_cents)} (${r.discount_note})` : ""}, dia ${r.due_day}${r.active ? "" : " (inativo)"}` : " — sem plano"}
                <input type="hidden" name="userId" value={r.user_id} />
                <label>Valor (R$) <input name="amount" inputMode="decimal" defaultValue={r.amount_cents ? (r.amount_cents / 100).toFixed(2).replace(".", ",") : ""} required /></label>
                <label>Desconto (R$, opcional) <input name="discount" inputMode="decimal" defaultValue={r.discount_cents ? (r.discount_cents / 100).toFixed(2).replace(".", ",") : ""} /></label>
                <label>Motivo do desconto <input name="discountNote" maxLength={120} defaultValue={r.discount_note ?? ""} placeholder="irmãos, bolsa…" /></label>
                <label>Vence no dia <input name="dueDay" type="number" min={1} max={28} defaultValue={r.due_day ?? 10} required /></label>
                <label>Cobrar a partir de <input name="startsOn" type="date" defaultValue={r.starts_on ?? today} required /></label>
                <label><input type="checkbox" name="active" defaultChecked={r.active ?? true} /> Plano ativo</label>
                <button type="submit">Salvar plano</button>
              </form>
              <Link href={`/academia/${id}/financeiro/alunos/${r.user_id}`}>Ver cobranças</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
