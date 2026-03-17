import styles from './KPICard.module.css';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
  };
  subtitle?: string;
}

export function KPICard({ label, value, trend, subtitle }: KPICardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {trend && (
        <div
          className={`${styles.trend} ${
            trend.direction === 'up'
              ? styles.trendUp
              : trend.direction === 'down'
                ? styles.trendDown
                : styles.trendFlat
          }`}
        >
          <span className={styles.trendArrow}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          </span>
          {Math.abs(trend.value)}%
          {subtitle && <span className={styles.subtitle}> {subtitle}</span>}
        </div>
      )}
      {!trend && subtitle && <div className={styles.subtitleOnly}>{subtitle}</div>}
    </div>
  );
}
