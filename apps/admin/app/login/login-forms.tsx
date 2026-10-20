"use client";

import { useActionState } from "react";
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
        <label>E-mail <input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha <input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" disabled={upPending}>{upPending ? "Enviando…" : "Cadastrar"}</button>
        <Status state={upState} />
      </form>
    </>
  );
}
