import Link from "next/link";
import { dependentRowSchema, guardianKindLabels } from "@dojo/contracts/guardians";
import { getCaller } from "@/lib/context";
import { AcceptInviteForm } from "./forms";

export default async function DependentesPage() {
  const { supabase } = await getCaller();
  const [{ data: raw }, { data: ageStatus }] = await Promise.all([supabase.rpc("list_my_dependents"), supabase.rpc("my_age_status")]);
  const dependents = ((raw ?? []) as unknown[]).map((x) => dependentRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const isAdult = ageStatus === "adult";

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Meus dependentes</h1>
      <p>Menores de 18 anos não têm login: o responsável cadastra o menor e usa o app em nome dele.</p>

      {dependents.length === 0 ? (
        <p>Você ainda não cadastrou nenhum menor.</p>
      ) : (
        <ul>
          {dependents.map((d) => (
            <li key={`${d.minor_user_id}-${d.kind}`}>
              {d.kind === "legal" && !d.minor_is_adult ? <Link href={`/dependentes/${d.minor_user_id}`}>{d.minor_name}</Link> : d.minor_name}
              {" "}— {guardianKindLabels[d.kind]} ({d.relationship})
              {d.minor_is_adult && " · já completou 18 anos: o acesso do responsável terminou"}
              {d.kind === "financial" && " · você cuida apenas da parte financeira"}
            </li>
          ))}
        </ul>
      )}

      {isAdult ? (
        <>
          <p><Link href="/dependentes/novo">Cadastrar um menor</Link></p>
          <section>
            <h2>Sou o responsável financeiro</h2>
            <p>Se o responsável legal gerou um código para você, informe aqui. Você não verá a frequência nem a graduação do menor.</p>
            <AcceptInviteForm />
          </section>
        </>
      ) : (
        <p role="note">Informe sua data de nascimento (maior de 18 anos) no perfil para cadastrar um menor.</p>
      )}
    </main>
  );
}
