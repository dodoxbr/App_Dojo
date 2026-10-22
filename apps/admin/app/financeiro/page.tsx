import Link from "next/link";
import { chargeStatusText, chargeTitle, formatCents, myChargeSchema, paymentMethodLabels, type MyCharge, type PaymentMethod } from "@dojo/contracts/finance";
import { dependentRowSchema } from "@dojo/contracts/guardians";
import { getCaller } from "@/lib/context";
import { fmtDate } from "@/lib/finance-ui";

function ChargeList({ charges }: { charges: MyCharge[] }) {
  if (charges.length === 0) return <p>Nenhuma cobrança registrada.</p>;
  return (
    <ul>
      {charges.map((c) => (
        <li key={c.id}>
          {c.academy_name} — {chargeTitle(c)} · {formatCents(c.amount_cents)} · vence {fmtDate(c.due_date)} · <strong>{chargeStatusText(c)}</strong>
          {c.status === "paid" && c.paid_on && ` em ${fmtDate(c.paid_on)} (${paymentMethodLabels[c.paid_method as PaymentMethod] ?? c.paid_method})`}
        </li>
      ))}
    </ul>
  );
}

// Read-only: the person, and the legal guardian / financial responsible of a minor, see the charges the manager registered.
export default async function MeuFinanceiroPage() {
  const { supabase } = await getCaller();
  const [{ data: mineRaw }, { data: depsRaw }] = await Promise.all([supabase.rpc("my_charges"), supabase.rpc("list_my_dependents")]);
  const mine = ((mineRaw ?? []) as unknown[]).map((x) => myChargeSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const dependents = ((depsRaw ?? []) as unknown[]).map((x) => dependentRowSchema.safeParse(x)).flatMap((r) => (r.success && !r.data.minor_is_adult ? [r.data] : []));
  const dependentCharges = await Promise.all(
    dependents.map(async (d) => {
      const { data } = await supabase.rpc("my_charges", { p_user_id: d.minor_user_id });
      return { d, charges: ((data ?? []) as unknown[]).map((x) => myChargeSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : [])) };
    }),
  );

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 960 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Meu financeiro</h1>
      <p role="note"><small>Consulta apenas: quem registra os pagamentos é o gestor da academia. A plataforma não recebe pagamentos.</small></p>
      <section>
        <h2>Minhas cobranças</h2>
        <ChargeList charges={mine} />
      </section>
      {dependentCharges.map(({ d, charges }) => (
        <section key={`${d.minor_user_id}-${d.kind}`}>
          <h2>{d.minor_name}{d.kind === "financial" ? " (você é o responsável financeiro)" : ""}</h2>
          <ChargeList charges={charges} />
        </section>
      ))}
    </main>
  );
}
