"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { PreservingForm } from "@/components/ui/PreservingForm";
import type { FormState } from "../login/actions";
import { giveImageConsent, revokeImageConsent } from "./image-consent-actions";

export type ImageConsentRow = { academy_id: string; academy_name: string; active: boolean; signed_at: string | null };

// Autorização de imagem no feed interno da academia: cada adulto decide (e pode mudar de ideia a qualquer momento).
export function ImageConsentItem({ row }: { row: ImageConsentRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => giveImageConsent(row.academy_id, prev, formData), {});
  const [revState, revokeAction, revoking] = useActionState<FormState, FormData>(() => revokeImageConsent(row.academy_id), {});
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0 }}>
        <strong>{row.academy_name}</strong>{" "}
        {row.active ? <Badge tone="success">Autorizado</Badge> : <Badge tone="neutral">Não autorizado</Badge>}
        {row.active && row.signed_at && <small> · desde {new Date(row.signed_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>}
      </p>
      {row.active ? (
        <form action={revokeAction}>
          <Button type="submit" variant="secondary" loading={revoking}>Revogar a autorização</Button>
          {revState.error && <Alert tone="danger">{revState.error}</Alert>}
        </form>
      ) : (
        <PreservingForm action={action} state={state}>
          <p style={{ margin: 0 }}><small>Autorizo que a minha imagem apareça em fotos do feed fechado desta academia (só para os membros, por 30 dias). Posso revogar quando quiser. <Link href="/termo-de-imagem" target="_blank">Ler o termo</Link> (rascunho, em revisão jurídica).</small></p>
          <label><input type="checkbox" name="agree" required /> Li e concordo</label>
          <label>Assinatura: digite o seu nome completo <input name="signature" autoComplete="name" minLength={5} maxLength={120} required /></label>
          <Button type="submit" loading={pending}>Autorizar o uso da minha imagem</Button>
          {state.error && <Alert tone="danger">{state.error}</Alert>}
          {state.message && <Alert tone="success">{state.message}</Alert>}
        </PreservingForm>
      )}
    </div>
  );
}
