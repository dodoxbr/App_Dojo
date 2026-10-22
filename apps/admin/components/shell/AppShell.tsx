import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui";
import { NavLinks } from "./NavLinks";
import { studentNav, type NavItem } from "./nav-items";
import styles from "./AppShell.module.css";

// Estrutura das telas logadas: barra lateral no desktop (a partir de 960 px), barra inferior no celular e topo com a marca.
// O conteúdo de cada tela (um <main>) entra como filho. Telas ainda no visual antigo podem usar o shell sem mudar o conteúdo.
export function AppShell({ children, items = studentNav, userName }: { children: ReactNode; items?: NavItem[]; userName?: string }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><BrandLogo tone="light" /></div>
        <NavLinks items={items} variant="side" />
        {userName && (
          <p className={styles.user}><span className={styles.avatar} aria-hidden="true">{userName.trim().charAt(0).toUpperCase()}</span>{userName}</p>
        )}
      </aside>
      <div className={styles.column}>
        <header className={styles.topbar}>
          <BrandLogo tone="light" />
        </header>
        <div className={styles.content}>{children}</div>
      </div>
      <NavLinks items={items} variant="bottom" />
    </div>
  );
}
