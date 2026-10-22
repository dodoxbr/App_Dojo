"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import styles from "./DataTable.module.css";

export type DataColumn = { key: string; label: string; align?: "left" | "center" | "right" };
export type DataRow = {
  id: string;
  /** Uma célula por coluna (o que aparece na tela). */
  cells: Record<string, ReactNode>;
  /** Texto usado na busca (nome, graduação…); minúsculas e sem acento são tratados aqui. */
  search: string;
  /** Marcas para os filtros (ex.: "sem-graduacao"). */
  tags?: string[];
};
export type DataFilter = { value: string; label: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Tabela de gestão do padrão Oss: busca, filtros em botões e, no celular, cada linha vira um cartão (o rótulo da coluna aparece antes do valor).
export function DataTable({
  columns,
  rows,
  searchLabel = "Buscar",
  filters = [],
  emptyText = "Nada encontrado.",
}: {
  columns: DataColumn[];
  rows: DataRow[];
  searchLabel?: string;
  filters?: DataFilter[];
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const searchId = useId();

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return rows.filter((r) => (!q || norm(r.search).includes(q)) && (!filter || r.tags?.includes(filter)));
  }, [rows, query, filter]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label htmlFor={searchId} className={styles.srOnly}>{searchLabel}</label>
          <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${searchLabel}…`} className={styles.searchInput} />
        </div>
        {filters.length > 0 && (
          <div className={styles.filters} role="group" aria-label="Filtros">
            <button type="button" className={`${styles.chip} ${filter === "" ? styles.chipOn : ""}`} aria-pressed={filter === ""} onClick={() => setFilter("")}>Todos</button>
            {filters.map((f) => (
              <button key={f.value} type="button" className={`${styles.chip} ${filter === f.value ? styles.chipOn : ""}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
            ))}
          </div>
        )}
        <p className={styles.count} aria-live="polite">{shown.length} de {rows.length}</p>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={styles[c.align ?? "left"]}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => <td key={c.key} data-label={c.label} className={styles[c.align ?? "left"]}>{r.cells[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
