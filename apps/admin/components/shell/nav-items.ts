export type NavIcon =
  | "home" | "diary" | "techniques" | "progress" | "profile"
  | "dashboard" | "people" | "classes" | "finance" | "health" | "settings" | "feed" | "award" | "family" | "book";

/** `primary` = aparece na barra inferior do celular; o resto fica em "Mais". Sem a marca, vale como primário. */
export type NavItem = { href: string; label: string; icon: NavIcon; primary?: boolean };

// Navegação do aluno (brief de UI/UX): Início, Diário, Técnicas, Evolução, Perfil.
export const studentNav: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/diario", label: "Diário", icon: "diary" },
  { href: "/tecnicas", label: "Técnicas", icon: "techniques" },
  { href: "/graduacao", label: "Evolução", icon: "progress" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
];

export type StaffRole = "manager" | "instructor" | "platform";
export type StaffPermissions = { validate: boolean; recommend: boolean; progress: boolean; assess: boolean; health: boolean };

// Navegação de quem trabalha numa academia. O gestor vê tudo da academia; o instrutor só o que as permissões liberam.
// O super admin da plataforma não vê financeiro, saúde nem feed (nem aqui): só o painel de frequência.
export function staffNav(academyId: string, role: StaffRole, permissions: StaffPermissions): NavItem[] {
  const a = `/academia/${academyId}`;
  if (role === "platform") {
    return [
      { href: "/plataforma", label: "Plataforma", icon: "settings" },
      { href: `${a}/painel`, label: "Painel", icon: "dashboard" },
    ];
  }
  if (role === "manager") {
    return [
      { href: `${a}/inicio`, label: "Início", icon: "home" },
      { href: `${a}/membros`, label: "Membros", icon: "people" },
      { href: `${a}/turmas`, label: "Turmas", icon: "classes" },
      { href: `${a}/graduacao/alunos`, label: "Graduação", icon: "award" },
      { href: `${a}/painel`, label: "Painel", icon: "dashboard", primary: false },
      { href: `${a}/responsaveis`, label: "Menores", icon: "family", primary: false },
      { href: `${a}/curriculos`, label: "Trilhas", icon: "book", primary: false },
      { href: `${a}/avaliacoes`, label: "Avaliações", icon: "progress", primary: false },
      { href: `${a}/financeiro`, label: "Financeiro", icon: "finance", primary: false },
      { href: `${a}/saude`, label: "Saúde", icon: "health", primary: false },
      { href: `/feed/${academyId}`, label: "Feed", icon: "feed", primary: false },
      { href: a, label: "Academia", icon: "settings", primary: false },
      { href: "/inicio", label: "Meu treino", icon: "profile", primary: false },
    ];
  }
  const items: NavItem[] = [
    { href: `${a}/inicio`, label: "Início", icon: "home" },
    { href: "/aulas", label: "Aulas", icon: "classes" },
  ];
  if (permissions.recommend || permissions.progress) items.push({ href: `${a}/graduacao/alunos`, label: "Alunos", icon: "award" });
  if (permissions.assess) items.push({ href: `${a}/avaliacoes`, label: "Avaliações", icon: "progress" });
  if (permissions.progress) items.push({ href: `${a}/painel`, label: "Painel", icon: "dashboard", primary: false });
  items.push({ href: `/feed/${academyId}`, label: "Feed", icon: "feed", primary: false });
  items.push({ href: "/inicio", label: "Meu treino", icon: "profile", primary: false });
  return items;
}
