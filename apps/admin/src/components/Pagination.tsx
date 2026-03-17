'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from './Pagination.module.css';

interface PaginationProps {
  total: number;
  pageSize: number;
  currentPage: number;
}

export function Pagination({ total, pageSize, currentPage }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className={styles.wrapper}>
      <span className={styles.info}>
        Page {currentPage} of {totalPages} ({total} results)
      </span>
      <div className={styles.buttons}>
        <button
          className={styles.btn}
          disabled={currentPage <= 1}
          onClick={() => goTo(currentPage - 1)}
        >
          Previous
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          return (
            <button
              key={pageNum}
              className={`${styles.btn} ${pageNum === currentPage ? styles.active : ''}`}
              onClick={() => goTo(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          className={styles.btn}
          disabled={currentPage >= totalPages}
          onClick={() => goTo(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
