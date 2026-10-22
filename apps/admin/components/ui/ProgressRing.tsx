import styles from "./ProgressRing.module.css";

// Anel de progresso (0 a 100 %) para fundo escuro. O número fica no centro; `label` descreve para leitores de tela.
export function ProgressRing({ percent, label, size = 120 }: { percent: number; label: string; size?: number }) {
  const value = Math.min(Math.max(Math.round(percent), 0), 100);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.ring} style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-bright)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ filter: "drop-shadow(0 0 6px var(--glow))" }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className={styles.value}>{value}<small>%</small></span>
    </div>
  );
}
