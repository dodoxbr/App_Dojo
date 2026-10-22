import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui";
import { NavLinks } from "./NavLinks";
import type { ShellAcademy } from "@/lib/shell-academy";
import { studentNav, type NavItem } from "./nav-items";
import styles from "./AppShell.module.css";

// Estrutura das telas logadas: barra lateral no desktop (a partir de 960 px), barra inferior no celular e topo com a marca.
// O conteúdo de cada tela (um <main>) entra como filho. Telas ainda no visual antigo podem usar o shell sem mudar o conteúdo.
export function AppShell({ children, items = studentNav, userName, academy }: { children: ReactNode; items?: NavItem[]; userName?: string; academy?: ShellAcademy }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><BrandLogo /></div>
        <NavLinks items={items} variant="side" />
        {userName && (
          <p className={styles.user}><span className={styles.avatar} aria-hidden="true">{userName.trim().charAt(0).toUpperCase()}</span>{userName}</p>
        )}
      </aside>
      <div className={styles.column}>
        <header className={`${styles.topbar} ${academy ? "" : styles.noAcademy}`}>
          <span className={styles.topLogo}><BrandLogo size={44} /></span>
          {academy && (
            <span className={styles.academyChip}>
              {academy.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={academy.logoUrl} alt="" aria-hidden="true" className={styles.academyLogo} />
              ) : (
                <span className={styles.academyInitial} aria-hidden="true">{academy.name.trim().charAt(0).toUpperCase()}</span>
              )}
              <span className={styles.academyName}>{academy.name}</span>
            </span>
          )}
        </header>
        <div className={styles.content}>{children}</div>
      </div>
      <NavLinks items={items} variant="bottom" />
    </div>
  );
}
