import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { staffNav, type StaffPermissions, type StaffRole } from "@/components/shell/nav-items";
import { shellAcademy } from "@/lib/shell-academy";
import { getCaller } from "@/lib/context";
import { knownFeatures } from "@dojo/contracts/features";

const PERMISSIONS = ["validate_attendance", "recommend_graduation", "view_progress", "assess_skills", "view_health"] as const;

// Navegação de quem trabalha na academia (gestor, instrutor, super admin). Quem não tem papel aqui continua vendo a página como antes
// (cada página já redireciona quem não pode entrar); a autorização de verdade é sempre do banco.
export default async function AcademiaLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = managedAcademies.some((a) => a.id === id);

  let role: StaffRole | null = isManager ? "manager" : null;
  let permissions: StaffPermissions = { validate: true, recommend: true, progress: true, assess: true, health: true };

  if (!role) {
    const { data: membership } = await supabase.from("memberships").select("role").eq("academy_id", id).eq("user_id", userId).eq("status", "approved").maybeSingle();
    if (membership?.role === "instructor") {
      const checks = await Promise.all(PERMISSIONS.map((p) => supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: p })));
      const [validate, recommend, progress, assess, health] = checks.map((c) => c.data === true);
      permissions = { validate: Boolean(validate), recommend: Boolean(recommend), progress: Boolean(progress), assess: Boolean(assess), health: Boolean(health) };
      role = "instructor";
    } else if (isPlatformAdmin) {
      role = "platform";
    }
  }

  if (!role) return <>{children}</>;
  const { data: enabled } = await supabase.rpc("academy_features", { p_academy_id: id });
  const features = new Set(knownFeatures((enabled ?? []) as string[]));
  const academy = await shellAcademy(supabase, id);
  return <AppShell items={staffNav(id, role, permissions, features)} academy={academy}>{children}</AppShell>;
}
