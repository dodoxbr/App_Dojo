import { LoginForms } from "./login-forms";

export default function LoginPage() {
  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 420 }}>
      <h1>Dojo Platform — Painel</h1>
      <LoginForms />
    </main>
  );
}
