"use client";

import { useActionState } from "react";
import { Alert, Button, PasswordField } from "@/components/ui";
import { updatePassword } from "./actions";
import type { FormState } from "../login/actions";
import styles from "../login/login.module.css";

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className={styles.form} aria-label="Nova senha">
      <PasswordField label="Nova senha" name="password" autoComplete="new-password" minLength={8} maxLength={72} hint="Mínimo de 8 caracteres." required />
      <PasswordField label="Confirmar a nova senha" name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" fullWidth loading={pending}>{pending ? "Salvando…" : "Salvar a nova senha"}</Button>
    </form>
  );
}
