'use client';

import styles from './FilterChips.module.css';

interface FilterChipsProps {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
}

export function FilterChips({ options, selected, onChange }: FilterChipsProps) {
  return (
    <div className={styles.wrapper}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.chip} ${selected === opt.value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
