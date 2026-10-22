"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { acceptInvite, createDependent, createInvite, requestForDependent, signPhotoTerm } from "./actions";
import type { FormState } from "../login/actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

function Status({ state }: { state: FormState }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.message) return <p role="status">{state.message}</p>;
  return null;
}

export function CreateDependentForm({ defaultName, defaultBirthDate }: { defaultName: string; defaultBirthDate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createDependent, {});
  const [key] = useState(() => crypto.randomUUID());
  return (
    <PreservingForm action={action} state={state}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <label>Nome do menor <input name="displayName" minLength={2} maxLength={120} defaultValue={defaultName} required /></label>
      <label>Data de nascimento do menor <input name="birthDate" type="date" min="1900-01-01" defaultValue={defaultBirthDate} required /></label>
      <label>Seu parentesco (ex.: mãe, pai, avó, tutor) <input name="relationship" minLength={2} maxLength={40} required /></label>
      <p><small>Você será o responsável legal e é quem usa o app em nome do menor. O menor não tem login próprio.</small></p>
      <button type="submit" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar menor"}</button>
      <Status state={state} />
    </PreservingForm>
  );
}

export function RequestForDependentForm({ minorId, academyId }: { minorId: string; academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => requestForDependent(minorId, academyId, prev, formData), {});
  return (
    <PreservingForm action={action} state={state}>
      <p>
        <small>
          Termo de consentimento (<strong>rascunho, em revisão jurídica</strong>): autorizo o menor a participar das aulas e que a academia
          trate os dados de frequência e graduação dele para essa finalidade. Posso revogar a qualquer momento, e o menor será suspenso.
        </small>
      </p>
      <label><input type="checkbox" name="consent" required /> Li e concordo com o termo de consentimento</label>
      <label><input type="checkbox" name="health" required /> Declaro que o menor está apto a praticar Jiu-Jitsu e que avisarei o professor sobre qualquer condição de saúde ou lesão (<Link href="/declaracao-de-saude" target="_blank">declaração de saúde</Link>)</label>
      <label><input type="checkbox" name="photos" /> Autorizo fotos do menor no feed da academia, visíveis só para os membros, por 30 dias, depois que o professor aprovar cada foto (opcional; desligado por padrão). Exige assinar o <Link href="/termo-de-imagem" target="_blank">termo de uso de imagem</Link> abaixo.</label>
      <label><input type="checkbox" name="social" /> Autorizo também a publicação de fotos do menor nas redes sociais da academia, como o Instagram (opcional; exige a autorização de fotos acima)</label>
      <label>Assinatura do termo de uso de imagem: digite o seu nome completo (só é necessário se autorizar fotos) <input name="signature" autoComplete="name" maxLength={120} /></label>
      <button type="submit" disabled={pending}>{pending ? "Enviando…" : "Pedir vaga para o menor"}</button>
      <Status state={state} />
    </PreservingForm>
  );
}

export function SignPhotoTermForm({ minorId, academyId }: { minorId: string; academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => signPhotoTerm(minorId, academyId, prev, formData), {});
  return (
    <PreservingForm action={action} state={state}>
      <p><small>Para poder postar fotos do menor e permitir que a academia as publique no feed (depois que o professor aprovar), assine o <Link href="/termo-de-imagem" target="_blank">termo de uso de imagem</Link> (<strong>rascunho, em revisão jurídica</strong>).</small></p>
      <label><input type="checkbox" name="agree" required /> Li e concordo com o termo de uso de imagem</label>
      <label><input type="checkbox" name="social" /> Autorizo também a publicação nas redes sociais da academia (opcional)</label>
      <label>Assinatura: digite o seu nome completo <input name="signature" autoComplete="name" minLength={5} maxLength={120} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Assinando…" : "Assinar o termo"}</button>
      <Status state={state} />
    </PreservingForm>
  );
}

export function InviteForm({ minorId }: { minorId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(() => createInvite(minorId), {});
  return (
    <PreservingForm action={action} state={state}>
      <button type="submit" disabled={pending}>{pending ? "Gerando…" : "Gerar código para outro responsável financeiro"}</button>
      <Status state={state} />
    </PreservingForm>
  );
}

export function AcceptInviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, {});
  return (
    <PreservingForm action={action} state={state}>
      <label>Código recebido <input name="code" minLength={10} maxLength={20} autoComplete="off" required /></label>
      <label>Seu parentesco com o menor <input name="relationship" minLength={2} maxLength={40} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Verificando…" : "Tornar-me responsável financeiro"}</button>
      <Status state={state} />
    </PreservingForm>
  );
}
