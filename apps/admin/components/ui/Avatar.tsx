import styles from "./Avatar.module.css";

// Círculo com a inicial do nome (sem foto: foto de perfil ainda não existe). Decorativo; o nome vem sempre ao lado.
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">{initial}</span>;
}
