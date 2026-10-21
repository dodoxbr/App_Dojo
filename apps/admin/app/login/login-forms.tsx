"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Button, CheckField, PasswordField, Tabs, TextField } from "@/components/ui";
import { signIn, signUp, type FormState } from "./actions";
import styles from "./login.module.css";

const initial: FormState = {};

// O React limpa o formulário depois de cada envio. Para a pessoa não perder o que digitou quando há erro, guardamos os campos
// que NÃO são senha e os devolvemos como valor inicial. As senhas sempre voltam vazias.
type Saved = Record<string, string>;
const keep = (formData: FormData, names: string[]): Saved => Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

function SignInForm({ next }: { next: string }) {
  const [saved, setSaved] = useState<Saved>({});
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => {
    setSaved(keep(formData, ["email"]));
    return signIn(prev, formData);
  }, initial);
  return (
    <form action={action} className={styles.form} aria-label="Entrar">
      <input type="hidden" name="next" value={next} />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" defaultValue={saved.email ?? ""} required />
      <PasswordField label="Senha" name="password" autoComplete="current-password" minLength={8} required />
      <Feedback state={state} />
      <Button type="submit" fullWidth loading={pending}>{pending ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
}

function SignUpForm() {
  // A confirmação da senha é conferida aqui; o servidor continua recebendo exatamente os mesmos campos de antes.
  const [saved, setSaved] = useState<Saved>({});
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => {
    setSaved(keep(formData, ["displayName", "birthDate", "dependentName", "dependentBirthDate", "email", "acceptTerms"]));
    if (formData.get("password") !== formData.get("confirmPassword")) return Promise.resolve({ error: "As senhas não conferem. Digite a mesma senha nos dois campos." });
    return signUp(prev, formData);
  }, initial);
  const [forMinor, setForMinor] = useState(false);
  return (
    <form action={action} className={styles.form} aria-label="Criar conta">
      <TextField label="Nome" name="displayName" autoComplete="name" minLength={2} maxLength={120} defaultValue={saved.displayName ?? ""} required />
      <TextField label="Data de nascimento" name="birthDate" type="date" autoComplete="bday" min="1900-01-01" defaultValue={saved.birthDate ?? ""} hint="Usada só para saber se você é maior de idade. Menores de 18 anos não criam conta: o responsável cria a conta e cadastra o menor." required />
      <CheckField name="forMinor" checked={forMinor} onChange={(e) => setForMinor(e.target.checked)}>
        Esta conta é para cuidar de um menor de idade (filho ou dependente)
      </CheckField>
      {forMinor && (
        <div className={styles.nested}>
          <TextField label="Nome do menor" name="dependentName" autoComplete="off" maxLength={120} defaultValue={saved.dependentName ?? ""} />
          <TextField label="Data de nascimento do menor" name="dependentBirthDate" type="date" min="1900-01-01" defaultValue={saved.dependentBirthDate ?? ""} hint="Você, adulto, será o responsável legal e usa o app em nome do menor. Depois de confirmar o e-mail, o cadastro do menor é concluído em “Meus dependentes”." />
        </div>
      )}
      <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" defaultValue={saved.email ?? ""} required />
      <PasswordField label="Senha" name="password" autoComplete="new-password" minLength={8} hint="Mínimo de 8 caracteres." required />
      <PasswordField label="Confirmar a senha" name="confirmPassword" autoComplete="new-password" minLength={8} required />
      <CheckField name="acceptTerms" defaultChecked={saved.acceptTerms === "on"} required>
        Li e aceito os <Link href="/termos" target="_blank">termos de uso e a política de privacidade</Link> (rascunho em revisão)
      </CheckField>
      <Feedback state={state} />
      <Button type="submit" fullWidth loading={pending}>{pending ? "Enviando…" : "Criar conta"}</Button>
    </form>
  );
}

export function LoginForms({ next, initialTab = "entrar" }: { next: string; initialTab?: "entrar" | "criar" }) {
  return (
    <Tabs
      label="Entrar ou criar conta"
      initial={initialTab}
      items={[
        { id: "entrar", label: "Entrar", content: <SignInForm next={next} /> },
        { id: "criar", label: "Criar conta", content: <SignUpForm /> },
      ]}
    />
  );
}
