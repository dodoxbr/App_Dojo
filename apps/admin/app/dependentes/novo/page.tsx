import Link from "next/link";
import { getCaller } from "@/lib/context";
import { CreateDependentForm } from "../forms";

// The sign-up checkbox ("conta para um menor") only prefills this form; the database validates everything again.
export default async function NovoDependentePage() {
  const { supabase } = await getCaller();
  const [{ data: ageStatus }, { data: userData }] = await Promise.all([supabase.rpc("my_age_status"), supabase.auth.getUser()]);
  const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
      <p><Link href="/dependentes">← Meus dependentes</Link></p>
      <h1>Cadastrar um menor</h1>
      {ageStatus !== "adult" ? (
        <p role="alert">Só um adulto (18 anos ou mais) pode cadastrar um menor. Informe sua data de nascimento no <Link href="/perfil">perfil</Link>.</p>
      ) : (
        <CreateDependentForm defaultName={text(meta.dependent_name, 120)} defaultBirthDate={text(meta.dependent_birth_date, 10)} />
      )}
    </main>
  );
}
