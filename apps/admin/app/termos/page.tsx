import Link from "next/link";
import { CURRENT_TERMS_VERSION, privacyPolicy, termsOfUse, type TermsSection } from "@dojo/contracts/terms";

function Sections({ items }: { items: TermsSection[] }) {
  return (
    <>
      {items.map((s) => (
        <section key={s.id} id={s.id}>
          <h3>{s.title}</h3>
          {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
    </>
  );
}

// Public page (no sign-in needed): the person reads the terms before creating the account.
export default function TermosPage() {
  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href="/login">← Entrar</Link></p>
      <h1>Termos de uso e política de privacidade</h1>
      <p role="note">
        <strong>Rascunho em revisão jurídica</strong> (versão {CURRENT_TERMS_VERSION}). O nome do responsável pelos dados e o canal de atendimento
        serão informados aqui antes da abertura ao público.
      </p>
      <h2>Termos de uso</h2>
      <Sections items={termsOfUse} />
      <h2>Política de privacidade</h2>
      <Sections items={privacyPolicy} />
    </main>
  );
}
