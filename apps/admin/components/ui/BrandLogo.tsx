import styles from "./BrandLogo.module.css";

// Logotipo do Oss (PROVISÓRIO até a versão final). A imagem traz o fundo escuro da marca; `lighten` a funde a superfícies escuras
// (menu lateral, topo, painéis). Não usar sobre fundo claro. `size` = altura em pixels.
export function BrandLogo({ size = 56 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/oss-site-logo.webp" alt="Oss, seu companheiro de treino" width={1000} height={547} className={styles.logo} style={{ height: size }} />
  );
}
