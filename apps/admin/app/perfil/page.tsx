import Link from "next/link";
import { membershipRoleLabels, membershipStatusLabels } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { ProfileForm } from "./profile-form";
import { signOut } from "./actions";

export default async function PerfilPage() {
  const { supabase, userId, isPlatformAdmin, canCreateAcademy, managedAcademies } = await getCaller();
  const { data: profile, error } = await supabase.from("profiles").select("display_name").eq("id", userId).single();

  const { data: mine } = await supabase.from("memberships").select("academy_id, role, status").eq("user_id", userId);
  const ids = (mine ?? []).map((m) => m.academy_id as string);
  const { data: academies } = ids.length
    ? await supabase.from("academies").select("id, name, slug").in("id", ids)
    : { data: [] as { id: string; name: string; slug: string }[] };
  const nameOf = new Map((academies ?? []).map((a) => [a.id, a.name]));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 420 }}>
      <h1>Meu perfil</h1>
      {error || !profile ? (
        <p role="alert">Não foi possível carregar o perfil.</p>
      ) : (
        <ProfileForm displayName={profile.display_name} />
      )}

      <section>
        <h2>Minhas academias</h2>
        {(mine ?? []).length === 0 ? (
          <p>Você ainda não faz parte de nenhuma academia. Peça o link ao gestor da sua academia.</p>
        ) : (
          <ul>
            {(mine ?? []).map((m) => (
              <li key={m.academy_id as string}>
                {nameOf.get(m.academy_id as string) ?? "Academia"} — {membershipRoleLabels[m.role as string]} ·{" "}
                {membershipStatusLabels[m.status as string]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Atalhos">
        <h2>Atalhos</h2>
        <ul>
          <li><Link href="/trilha">Minha trilha</Link></li>
          <li><Link href="/aulas">Agenda de aulas</Link></li>
          <li><Link href="/diario">Meu diário</Link></li>
          <li><Link href="/tecnicas">Catálogo de técnicas</Link></li>
          {isPlatformAdmin && <li><Link href="/plataforma">Plataforma (super admin)</Link></li>}
          {canCreateAcademy && <li><Link href="/academias/nova">Criar academia</Link></li>}
          {managedAcademies.map((a) => (
            <li key={a.id}><Link href={`/academia/${a.id}`}>Gerenciar: {a.name}</Link></li>
          ))}
        </ul>
      </nav>

      <form action={signOut}><button type="submit">Sair</button></form>
    </main>
  );
}
