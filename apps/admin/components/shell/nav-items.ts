export type NavIcon = "home" | "diary" | "techniques" | "progress" | "profile";
export type NavItem = { href: string; label: string; icon: NavIcon };

// Navegação do aluno (brief de UI/UX): Início, Diário, Técnicas, Evolução, Perfil.
export const studentNav: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/diario", label: "Diário", icon: "diary" },
  { href: "/tecnicas", label: "Técnicas", icon: "techniques" },
  { href: "/graduacao", label: "Evolução", icon: "progress" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
];
