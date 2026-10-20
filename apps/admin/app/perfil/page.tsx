import Link from "next/link";
import { getCaller } from "@/lib/context";
import { ProfileForm } from "./profile-form";
import { signOut } from "./actions";

export default async function PerfilPage() {
  const { supabase, isPlatformAdmin, canCreateAcademy, managedAcademies } = await getCaller();
  const { data: profile, error } = await supabase.from("profiles").select("display_name").single();

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 420 }}>
      <h1>Meu perfil</h1>
      {error || !profile ? (
        <p role="alert">Não foi possível carregar o perfil.</p>
      ) : (
        <ProfileForm displayName={profile.display_name} />
      )}

      {(isPlatformAdmin || canCreateAcademy || managedAcademies.length > 0) && (
        <nav aria-label="Atalhos">
          <h2>Atalhos</h2>
          <ul>
            {isPlatformAdmin && <li><Link href="/plataforma">Plataforma (super admin)</Link></li>}
            {canCreateAcademy && <li><Link href="/academias/nova">Criar academia</Link></li>}
            {managedAcademies.map((a) => (
              <li key={a.id}><Link href={`/academia/${a.id}`}>Gerenciar: {a.name}</Link></li>
            ))}
          </ul>
        </nav>
      )}

      <form action={signOut}><button type="submit">Sair</button></form>
    </main>
  );
}
