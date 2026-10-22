import styles from "./BrandLogo.module.css";

// Marca PROVISÓRIA da plataforma: "Oss" (a saudação do jiu-jitsu) com uma faixa atada. Desenhada aqui, sem ativo externo; quando
// houver o logotipo oficial, troque só este componente. Em fundo escuro use tone="light".
export function BrandLogo({ tone = "dark", showName = true }: { tone?: "dark" | "light"; showName?: boolean }) {
  return (
    <span className={`${styles.logo} ${tone === "light" ? styles.light : ""}`}>
      <svg className={styles.mark} viewBox="0 0 40 40" role="img" aria-label="Oss" focusable="false">
        <rect width="40" height="40" rx="11" className={styles.markBg} />
        <path d="M8 24 L32 14" className={styles.band} />
        <path d="M8 16 L32 26" className={styles.bandAccent} />
        <rect x="16" y="15" width="8" height="10" rx="2.5" className={styles.knot} />
      </svg>
      {showName && <span className={styles.name}>Oss<span className={styles.bang}>!</span></span>}
    </span>
  );
}
