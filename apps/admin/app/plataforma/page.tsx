import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { GrantForm } from "./grant-form";
import { revokeCreator, setAcademyPlan } from "./actions";

export default async function PlataformaPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, isPlatformAdmin } = await getCaller();
  if (!isPlatformAdmin) redirect("/perfil");

  const [creators, academies, plansRes] = await Promise.all([
    supabase.from("academy_creators").select("user_id, granted_at, revoked_at").order("granted_at", { ascending: false }),
    supabase.from("academies").select("id, name, slug, plan_code").order("created_at", { ascending: false }),
    supabase.from("plans").select("code, name, position").order("position"),
  ]);
  const planList = (plansRes.data ?? []) as { code: string; name: string }[];

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Plataforma</h1>

      {ok === "plano" && <p role="status">Pacote da academia atualizado.</p>}
      {erro === "plano" && <p role="alert">Não foi possível atualizar o pacote.</p>}
      <p><Link href="/plataforma/diarios">Diários (acesso de teste)</Link> · <Link href="/plataforma/pacotes">Pacotes (o que cada um inclui)</Link></p>

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
              <li key={a.id}>
                <Link href={`/academia/${a.id}`}>{a.name}</Link> ({a.slug})
                <form action={setAcademyPlan} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input type="hidden" name="academyId" value={a.id} />
                  <label>Pacote <select name="planCode" defaultValue={a.plan_code as string}>{planList.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
                  <button type="submit">Salvar pacote</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
