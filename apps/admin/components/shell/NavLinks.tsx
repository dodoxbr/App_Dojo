"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIcon, NavItem } from "./nav-items";
import styles from "./AppShell.module.css";

const paths: Record<NavIcon, string> = {
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  diary: "M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 5h6M9 12h6M9 16h4",
  techniques: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z",
  progress: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Uma lista de links: vira barra inferior no celular e barra lateral no desktop (o CSS decide). Marca a página atual.
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "bottom" | "side" }) {
  const pathname = usePathname();
  return (
    <nav aria-label={variant === "bottom" ? "Navegação principal" : "Menu lateral"} className={variant === "bottom" ? styles.bottomNav : styles.sideNav}>
      <ul className={styles.navList}>
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className={styles.navItem}>
              <Link href={item.href} className={styles.navLink} aria-current={current ? "page" : undefined}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
