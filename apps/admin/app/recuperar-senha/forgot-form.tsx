"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { requestPasswordReset } from "./actions";
import type { FormState } from "../login/actions";
import styles from "../login/login.module.css";

export function ForgotForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className={styles.form} aria-label="Recuperar senha">
      {linkExpired && !state.message && <Alert tone="danger">Este link venceu ou já foi usado. Peça um novo abaixo.</Alert>}
      <TextField label="E-mail da sua conta" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" required />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Button type="submit" fullWidth loading={pending}>{pending ? "Enviando…" : "Enviar o link"}</Button>
      <Link href="/login" className={styles.forgot}>Voltar para entrar</Link>
    </form>
  );
}
