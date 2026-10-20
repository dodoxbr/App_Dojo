"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type FormState } from "./actions";

const initial: FormState = {};

function Status({ state }: { state: FormState }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.message) return <p role="status">{state.message}</p>;
  return null;
}

export function LoginForms({ next }: { next: string }) {
  const [inState, inAction, inPending] = useActionState(signIn, initial);
  const [upState, upAction, upPending] = useActionState(signUp, initial);
  const [forMinor, setForMinor] = useState(false);

  return (
    <>
      <form action={inAction}>
        <h2>Entrar</h2>
        <input type="hidden" name="next" value={next} />
        <label>E-mail <input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha <input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <button type="submit" disabled={inPending}>{inPending ? "Entrando…" : "Entrar"}</button>
        <Status state={inState} />
      </form>
      <form action={upAction}>
        <h2>Criar conta</h2>
        <label>Nome <input name="displayName" autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>Data de nascimento <input name="birthDate" type="date" autoComplete="bday" min="1900-01-01" required /></label>
        <p><small>Usada só para saber se você é maior de idade. Menores de 18 anos não criam conta: o responsável cria a conta dele e cadastra o menor.</small></p>
        <label>
          <input type="checkbox" name="forMinor" checked={forMinor} onChange={(e) => setForMinor(e.target.checked)} /> Esta conta é para cuidar de um menor de idade (filho ou dependente)
        </label>
        {forMinor && (
          <>
            <label>Nome do menor <input name="dependentName" autoComplete="off" maxLength={120} /></label>
            <label>Data de nascimento do menor <input name="dependentBirthDate" type="date" min="1900-01-01" /></label>
            <p><small>Você, adulto, será o responsável legal e usa o app em nome do menor. Depois de confirmar o e-mail, o cadastro do menor é concluído na área &quot;Meus dependentes&quot;.</small></p>
          </>
        )}
        <label>E-mail <input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha <input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" disabled={upPending}>{upPending ? "Enviando…" : "Cadastrar"}</button>
        <Status state={upState} />
      </form>
    </>
  );
}
