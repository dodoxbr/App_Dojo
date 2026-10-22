import { paymentMethodLabels, paymentMethods, type ChargeStatus } from "@dojo/contracts/finance";
import { Button } from "@/components/ui";
import { cancelCharge, markPaid, reopenCharge, waiveCharge } from "./actions";
import styles from "./charge-actions.module.css";

// The manager's buttons for one charge: mark as paid while open (cancel / waive tucked under "Mais ações"), reopen (correction) afterwards.
export function ChargeActions({ academyId, chargeId, status, today, next }: { academyId: string; chargeId: string; status: ChargeStatus; today: string; next: string }) {
  const hidden = (
    <>
      <input type="hidden" name="chargeId" value={chargeId} />
      <input type="hidden" name="next" value={next} />
    </>
  );
  if (status !== "open") {
    return (
      <details className={styles.more}>
        <summary>Corrigir (reabrir)</summary>
        <form action={reopenCharge.bind(null, academyId)} className={styles.form}>
          {hidden}
          <label>Motivo da correção <input name="reason" minLength={3} maxLength={500} required /></label>
          <Button type="submit" variant="secondary">Reabrir</Button>
        </form>
      </details>
    );
  }
  return (
    <div className={styles.actions}>
      <form action={markPaid.bind(null, academyId)} className={styles.pay}>
        {hidden}
        <label>
          Forma{" "}
          <select name="method" defaultValue="pix">
            {paymentMethods.map((m) => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
          </select>
        </label>
        <label>Recebido em <input name="paidOn" type="date" defaultValue={today} max={today} required /></label>
        <label>Observação <input name="note" maxLength={500} /></label>
        <Button type="submit">Marcar como pago</Button>
      </form>
      <details className={styles.more}>
        <summary>Mais ações (cancelar ou isentar)</summary>
        <div className={styles.moreBody}>
          <form action={cancelCharge.bind(null, academyId)} className={styles.form}>
            {hidden}
            <label>Motivo <input name="reason" minLength={3} maxLength={500} required /></label>
            <Button type="submit" variant="secondary">Cancelar cobrança</Button>
          </form>
          <form action={waiveCharge.bind(null, academyId)} className={styles.form}>
            {hidden}
            <label>Motivo <input name="reason" minLength={3} maxLength={500} required /></label>
            <Button type="submit" variant="secondary">Isentar</Button>
          </form>
        </div>
      </details>
    </div>
  );
}
