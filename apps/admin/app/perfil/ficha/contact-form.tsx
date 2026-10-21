"use client";

import { useActionState } from "react";
import { saveContact } from "./actions";
import { BRAZIL_UFS, formatPhone, formatPostalCode, type ContactRow } from "@dojo/contracts/contacts";
import type { FormState } from "../../login/actions";

export function ContactForm({ userId, current, suggestedName }: { userId: string; current: ContactRow | null; suggestedName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => saveContact(userId, prev, formData), {});
  return (
    <form action={action}>
      {/* Os campos remontam quando a ficha salva muda (volta o valor salvo); a mensagem fica fora para não sumir. */}
      <div key={current?.updated_at ?? "novo"} style={{ display: "contents" }}>
      <label>Nome completo <input name="fullName" minLength={2} maxLength={160} autoComplete="name" defaultValue={current?.full_name ?? suggestedName} required /></label>
      <label>Telefone com DDD <input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={current ? formatPhone(current.phone) : ""} required /></label>
      <label>CEP <input name="postalCode" inputMode="numeric" autoComplete="postal-code" defaultValue={current ? formatPostalCode(current.postal_code) : ""} required /></label>
      <label>Rua <input name="street" maxLength={160} autoComplete="address-line1" defaultValue={current?.street ?? ""} required /></label>
      <label>Número <input name="number" maxLength={20} defaultValue={current?.number ?? ""} required /></label>
      <label>Complemento (opcional) <input name="complement" maxLength={80} defaultValue={current?.complement ?? ""} /></label>
      <label>Bairro <input name="neighborhood" maxLength={80} defaultValue={current?.neighborhood ?? ""} required /></label>
      <label>Cidade <input name="city" maxLength={80} autoComplete="address-level2" defaultValue={current?.city ?? ""} required /></label>
      <label>
        Estado{" "}
        <select name="state" defaultValue={current?.state ?? ""} required>
          <option value="" disabled>Escolha…</option>
          {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Contato de emergência</legend>
        <label>Nome <input name="emergencyName" minLength={2} maxLength={120} defaultValue={current?.emergency_name ?? ""} required /></label>
        <label>Telefone com DDD <input name="emergencyPhone" type="tel" inputMode="tel" defaultValue={current?.emergency_phone ? formatPhone(current.emergency_phone) : ""} required /></label>
        <label>Parentesco ou relação <input name="emergencyRelationship" minLength={2} maxLength={40} defaultValue={current?.emergency_relationship ?? ""} required /></label>
      </fieldset>
      <fieldset>
        <legend>Saúde (opcional)</legend>
        <label>Alergias, lesões, medicamentos ou condições que o professor deve saber <textarea name="healthNotes" rows={3} maxLength={500} defaultValue={current?.health_notes ?? ""} /></label>
        <label><input type="checkbox" name="healthConsent" defaultChecked={Boolean(current?.health_consent_at)} /> Autorizo o uso destas informações de saúde para a segurança nos treinos (dado sensível; só você, o responsável e o gestor da academia conseguem ver)</label>
      </fieldset>
      </div>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar ficha"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
