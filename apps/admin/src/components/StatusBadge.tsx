import styles from './StatusBadge.module.css';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface StatusBadgeProps {
  label: string;
  variant?: Variant;
}

export function StatusBadge({ label, variant = 'default' }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {label}
    </span>
  );
}
