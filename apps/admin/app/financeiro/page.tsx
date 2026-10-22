import { chargeStatusText, chargeTitle, formatCents, myChargeSchema, paymentMethodLabels, type MyCharge, type PaymentMethod } from "@dojo/contracts/finance";
import { dependentRowSchema } from "@dojo/contracts/guardians";
import { Badge, Card, EmptyState, Page, PageHero } from "@/components/ui";
import styles from "./financeiro.module.css";
import { getCaller } from "@/lib/context";
import { fmtDate } from "@/lib/finance-ui";

function ChargeList({ charges }: { charges: MyCharge[] }) {
  if (charges.length === 0) return <EmptyState title="Nenhuma cobrança registrada" />;
  return (
    <ul className={styles.charges}>
      {charges.map((c) => {
        const paid = c.status === "paid";
        return (
          <li key={c.id} className={styles.charge}>
            <div className={styles.chargeText}>
              <strong>{chargeTitle(c)}</strong>
              <small>{c.academy_name} · vence {fmtDate(c.due_date)}{paid && c.paid_on ? ` · pago em ${fmtDate(c.paid_on)} (${paymentMethodLabels[c.paid_method as PaymentMethod] ?? c.paid_method})` : ""}</small>
            </div>
            <div className={styles.chargeSide}>
              <strong className={styles.amount}>{formatCents(c.amount_cents)}</strong>
              <Badge tone={paid ? "success" : c.status === "cancelled" || c.status === "waived" ? "neutral" : "info"}>{chargeStatusText(c)}</Badge>
            </div>
          </li>
        );
      })}
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

  const open = mine.filter((c) => c.status !== "paid" && c.status !== "cancelled" && c.status !== "waived").length;
  return (
    <Page width="narrow">
      <PageHero
        eyebrow="Financeiro"
        title="Meu financeiro"
        subtitle="Consulta apenas: quem registra os pagamentos é o gestor da academia. A plataforma não recebe pagamentos."
        aside={<span className={styles.count} aria-label={`${open} cobranças em aberto`}><strong>{open}</strong><small>em aberto</small></span>}
      />
      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Minhas cobranças</h2>
        <ChargeList charges={mine} />
      </Card>
      {dependentCharges.map(({ d, charges }) => (
        <Card key={`${d.minor_user_id}-${d.kind}`}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>{d.minor_name}{d.kind === "financial" ? " (você é o responsável financeiro)" : ""}</h2>
          <ChargeList charges={charges} />
        </Card>
      ))}
    </Page>
  );
}
