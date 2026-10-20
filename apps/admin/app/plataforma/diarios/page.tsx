import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { techniquesByLog } from "@/lib/diary";

// TEST PHASE: the platform admin reads every diary only while platform_settings.admin_diary_access is on.
export default async function DiariosAdminPage() {
  const { supabase, isPlatformAdmin } = await getCaller();
  if (!isPlatformAdmin) redirect("/perfil");

  const [{ data: settings }, { data: logs }] = await Promise.all([
    supabase.from("platform_settings").select("admin_diary_access").maybeSingle(),
    supabase
      .from("training_logs")
      .select("id, user_id, academy_id, trained_at, notes")
      .order("trained_at", { ascending: false })
      .limit(50),
  ]);
  const enabled = settings?.admin_diary_access === true;
  const rows = logs ?? [];
  const userIds = [...new Set(rows.map((l) => l.user_id as string))];
  const [{ data: profiles }, techniques] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    techniquesByLog(supabase, rows.map((l) => l.id as string)),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href="/plataforma">← Plataforma</Link></p>
      <h1>Diários (acesso de teste)</h1>
      <p role="note">
        Acesso temporário do super admin, só para a fase de teste. Antes de usar dados reais, desligue com{" "}
        <code>node scripts/set-admin-diary-access.mjs off</code>. O diário é privado para todos os demais.
      </p>
      {!enabled ? (
        <p role="status">A chave de acesso está desligada: nenhum diário é exibido.</p>
      ) : rows.length === 0 ? (
        <p>Nenhum registro ainda.</p>
      ) : (
        <ul>
          {rows.map((l) => (
            <li key={l.id as string}>
              <strong>{nameOf.get(l.user_id as string) ?? "Usuário"}</strong> —{" "}
              {new Date(l.trained_at as string).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              {(techniques.get(l.id as string) ?? []).length > 0 && (
                <> · {(techniques.get(l.id as string) ?? []).map((t) => t.name).join(", ")}</>
              )}
              {l.notes ? <p>{l.notes as string}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
