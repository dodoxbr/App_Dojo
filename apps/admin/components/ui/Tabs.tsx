"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export type TabItem = { id: string; label: string; content: ReactNode };

// Abas acessíveis (setas, Home e End). Todos os painéis ficam montados e os inativos ficam ocultos: o que a pessoa já digitou
// numa aba não se perde ao trocar de aba.
export function Tabs({ items, initial, label }: { items: TabItem[]; initial?: string; label: string }) {
  const base = useId();
  const [active, setActive] = useState(items.some((i) => i.id === initial) ? (initial as string) : (items[0]?.id ?? ""));
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (index: number) => {
    const target = items[(index + items.length) % items.length];
    if (!target) return;
    setActive(target.id);
    refs.current[target.id]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); move(0); }
    else if (event.key === "End") { event.preventDefault(); move(items.length - 1); }
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => { refs.current[item.id] = el; }}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={active === item.id}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div key={item.id} role="tabpanel" id={`${base}-panel-${item.id}`} aria-labelledby={`${base}-tab-${item.id}`} hidden={active !== item.id} className={styles.panel}>
          {item.content}
        </div>
      ))}
    </div>
  );
}
