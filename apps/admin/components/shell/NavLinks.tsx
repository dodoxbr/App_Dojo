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
  dashboard: "M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-3H4z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  classes: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  finance: "M12 3v18M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.6 0-4.5 1.2-4.5 3.2 0 4.6 9 2.2 9 6.6 0 2-2 3.2-4.5 3.2-2.2 0-3.8-.9-4.7-2.3",
  health: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  feed: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9.5h.01",
  award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.5 7 21l5-3 5 3-1.5-7.5",
  family: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 21v-3a5 5 0 0 1 10 0v3M15 21v-2a4 4 0 0 1 6 0v2",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const isCurrent = (pathname: string, item: NavItem, all: NavItem[]) => {
  // A página mais específica ganha: /academia/x não fica marcada em /academia/x/membros se houver o item de membros.
  const matches = all.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === item.href;
};

function Link1({ item, items, pathname }: { item: NavItem; items: NavItem[]; pathname: string }) {
  const current = isCurrent(pathname, item, items);
  return (
    <Link href={item.href} className={styles.navLink} aria-current={current ? "page" : undefined}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

// Barra lateral (desktop) ou barra inferior (celular). Na barra inferior, o que não é primário vai para "Mais".
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "bottom" | "side" }) {
  const pathname = usePathname();
  const primary = items.filter((i) => i.primary !== false);
  const extra = items.filter((i) => i.primary === false);
  const bottom = variant === "bottom";
  const shown = bottom ? primary : items;
  const moreActive = bottom && extra.some((i) => isCurrent(pathname, i, items));

  return (
    <nav aria-label={bottom ? "Navegação principal" : "Menu lateral"} className={bottom ? styles.bottomNav : styles.sideNav}>
      <ul className={styles.navList}>
        {shown.map((item) => (
          <li key={item.href} className={styles.navItem}><Link1 item={item} items={items} pathname={pathname} /></li>
        ))}
        {bottom && extra.length > 0 && (
          <li className={styles.navItem}>
            <details className={styles.more}>
              <summary className={styles.navLink} aria-current={moreActive ? "page" : undefined}>
                <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
                  <path d="M5 12h.01M12 12h.01M19 12h.01" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>Mais</span>
              </summary>
              <ul className={styles.morePanel}>
                {extra.map((item) => (
                  <li key={item.href}><Link1 item={item} items={items} pathname={pathname} /></li>
                ))}
              </ul>
            </details>
          </li>
        )}
      </ul>
    </nav>
  );
}
