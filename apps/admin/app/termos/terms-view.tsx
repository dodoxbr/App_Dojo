import Link from "next/link";
import { CURRENT_TERMS_VERSION, fillTerms, privacyPolicy, termsOfUse, type TermsSection, type TermsVars } from "@dojo/contracts/terms";

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

// The company that runs the platform comes from the environment (server-only variables); empty means "a definir".
export function platformVars(): Pick<TermsVars, "operador" | "operador_cnpj"> {
  return { operador: process.env.PLATFORM_LEGAL_NAME || null, operador_cnpj: process.env.PLATFORM_CNPJ || null };
}

export function TermsView({ vars, academyName }: { vars: TermsVars; academyName?: string }) {
  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href="/login">← Entrar</Link></p>
      <h1>Termos de uso e política de privacidade{academyName ? ` — ${academyName}` : ""}</h1>
      <p role="note">
        <strong>Rascunho em revisão jurídica</strong> (versão {CURRENT_TERMS_VERSION}). Os dados da empresa são preenchidos pela academia
        no cadastro dela; o que ainda não foi informado aparece como &quot;a definir&quot;.
      </p>
      <h2>Termos de uso</h2>
      <Sections items={fillTerms(termsOfUse, vars)} />
      <h2>Política de privacidade</h2>
      <Sections items={fillTerms(privacyPolicy, vars)} />
    </main>
  );
}
