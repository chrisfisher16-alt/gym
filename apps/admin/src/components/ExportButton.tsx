'use client';

import styles from './ExportButton.module.css';

interface ExportButtonProps {
  label?: string;
  onClick?: () => void;
}

export function ExportButton({ label = 'Export CSV', onClick }: ExportButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Placeholder — will be wired up later
      alert('Export functionality coming soon');
    }
  };

  return (
    <button className={styles.button} onClick={handleClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </button>
  );
}
