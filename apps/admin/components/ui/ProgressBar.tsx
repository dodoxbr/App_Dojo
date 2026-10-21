import styles from "./ProgressBar.module.css";

// Barra de progresso acessível. `max` > 0; o valor é limitado a 0..max. O texto de apoio fica por conta de quem usa.
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);
  return (
    <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={clamped}>
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}
