import { paymentMethodLabels, paymentMethods, type ChargeStatus } from "@dojo/contracts/finance";
import { cancelCharge, markPaid, reopenCharge, waiveCharge } from "./actions";

// The manager's buttons for one charge: mark as paid / cancel / waive while open, reopen (correction) afterwards.
export function ChargeActions({ academyId, chargeId, status, today, next }: { academyId: string; chargeId: string; status: ChargeStatus; today: string; next: string }) {
  const hidden = (
    <>
      <input type="hidden" name="chargeId" value={chargeId} />
      <input type="hidden" name="next" value={next} />
    </>
  );
  if (status !== "open") {
    return (
      <form action={reopenCharge.bind(null, academyId)}>
        {hidden}
        <label>Motivo da correção <input name="reason" minLength={3} maxLength={500} required /></label>
        <button type="submit">Reabrir</button>
      </form>
    );
  }
  return (
    <div>
      <form action={markPaid.bind(null, academyId)}>
        {hidden}
        <label>
          Forma{" "}
          <select name="method" defaultValue="pix">
            {paymentMethods.map((m) => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
          </select>
        </label>
        <label>Recebido em <input name="paidOn" type="date" defaultValue={today} max={today} required /></label>
        <label>Observação <input name="note" maxLength={500} /></label>
        <button type="submit">Marcar como pago</button>
      </form>
      <form action={cancelCharge.bind(null, academyId)}>
        {hidden}
        <label>Motivo <input name="reason" minLength={3} maxLength={500} required /></label>
        <button type="submit">Cancelar cobrança</button>
      </form>
      <form action={waiveCharge.bind(null, academyId)}>
        {hidden}
        <label>Motivo <input name="reason" minLength={3} maxLength={500} required /></label>
        <button type="submit">Isentar</button>
      </form>
    </div>
  );
}
