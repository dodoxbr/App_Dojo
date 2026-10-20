import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { GrantForm } from "./grant-form";
import { revokeCreator } from "./actions";

export default async function PlataformaPage() {
  const { supabase, isPlatformAdmin } = await getCaller();
  if (!isPlatformAdmin) redirect("/perfil");

  const [creators, academies] = await Promise.all([
    supabase.from("academy_creators").select("user_id, granted_at, revoked_at").order("granted_at", { ascending: false }),
    supabase.from("academies").select("id, name, slug").order("created_at", { ascending: false }),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Plataforma</h1>

      <p><Link href="/plataforma/diarios">Diários (acesso de teste)</Link></p>

      <section>
        <h2>Liberar criação de academias</h2>
        <GrantForm />
      </section>

      <section>
        <h2>Criadores liberados</h2>
        {creators.error ? (
          <p role="alert">Não foi possível carregar.</p>
        ) : creators.data.length === 0 ? (
          <p>Nenhum criador liberado ainda.</p>
        ) : (
          <ul>
            {creators.data.map((c) => (
              <li key={c.user_id}>
                {c.user_id.slice(0, 8)}… — liberado em {new Date(c.granted_at).toLocaleDateString("pt-BR")}
                {c.revoked_at ? " (revogado)" : (
                  <form action={revokeCreator} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="userId" value={c.user_id} />
                    <button type="submit">Revogar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Academias</h2>
        {academies.error ? (
          <p role="alert">Não foi possível carregar.</p>
        ) : academies.data.length === 0 ? (
          <p>Nenhuma academia criada ainda.</p>
        ) : (
          <ul>
            {academies.data.map((a) => (
              <li key={a.id}><Link href={`/academia/${a.id}`}>{a.name}</Link> ({a.slug})</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
