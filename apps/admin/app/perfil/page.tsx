import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { signOut } from "./actions";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile, error } = await supabase.from("profiles").select("display_name").single();

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 420 }}>
      <h1>Meu perfil</h1>
      {error || !profile ? (
        <p role="alert">Não foi possível carregar o perfil.</p>
      ) : (
        <ProfileForm displayName={profile.display_name} />
      )}
      <form action={signOut}><button type="submit">Sair</button></form>
    </main>
  );
}
