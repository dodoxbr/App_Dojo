import type { ReactNode } from "react";
import { knownFeatures } from "@dojo/contracts/features";
import { getCaller } from "@/lib/context";
import { shellAcademy } from "@/lib/shell-academy";
import { AppShell } from "./AppShell";
import { staffNav, studentNav, type NavItem, type StaffPermissions } from "./nav-items";

const PERMISSIONS = ["validate_attendance", "recommend_graduation", "view_progress", "assess_skills", "view_health"] as const;

// Shell das telas pessoais e compartilhadas (perfil, diário, aulas, desafios, feed…): escolhe o menu de quem está logado.
// Aluno (ou responsável): menu do aluno, com "Equipe" se também trabalhar numa academia. Quem só trabalha na equipe: menu da equipe.
// Só escolhe o menu; a autorização continua sendo do banco e de cada página.
export async function AutoShell({ children }: { children: ReactNode }) {
  const { supabase, userId } = await getCaller();
  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("academy_id, role").eq("user_id", userId).eq("status", "approved"),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  const rows = memberships ?? [];
  const isStudent = rows.some((m) => m.role === "student");
  const staff = rows.find((m) => m.role === "manager") ?? rows.find((m) => m.role === "instructor");

  let items: NavItem[] = studentNav;
  if (staff) {
    const academyId = staff.academy_id as string;
    const { data: enabled } = await supabase.rpc("academy_features", { p_academy_id: academyId });
    const features = new Set(knownFeatures((enabled ?? []) as string[]));
    if (isStudent) {
      items = [...studentNav, { href: `/academia/${academyId}/inicio`, label: "Equipe", icon: "people", primary: false }];
    } else if (staff.role === "manager") {
      items = staffNav(academyId, "manager", { validate: true, recommend: true, progress: true, assess: true, health: true }, features);
    } else {
      const checks = await Promise.all(PERMISSIONS.map((p) => supabase.rpc("has_academy_permission", { p_academy_id: academyId, p_permission: p })));
      const [validate, recommend, progress, assess, health] = checks.map((c) => c.data === true);
      const permissions: StaffPermissions = { validate: Boolean(validate), recommend: Boolean(recommend), progress: Boolean(progress), assess: Boolean(assess), health: Boolean(health) };
      items = staffNav(academyId, "instructor", permissions, features);
    }
  }
  // A academia do cabeçalho: a de quem trabalha na equipe; senão a primeira em que a pessoa é aluna.
  const academyId = (staff ?? rows[0])?.academy_id as string | undefined;
  const academy = academyId ? await shellAcademy(supabase, academyId) : undefined;
  return <AppShell items={items} userName={(profile?.display_name as string | undefined) ?? undefined} academy={academy}>{children}</AppShell>;
}
