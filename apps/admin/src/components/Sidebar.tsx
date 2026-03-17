'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { label: 'Overview', href: '/overview', icon: '◎' },
  { label: 'Users', href: '/users', icon: '◉' },
  { label: 'Revenue', href: '/revenue', icon: '$' },
  { label: 'Usage', href: '/usage', icon: '≡' },
  { label: 'AI Ops', href: '/ai-ops', icon: '⚡' },
  { label: 'Notifications', href: '/notifications', icon: '⊕' },
  { label: 'Config', href: '/config', icon: '⚙' },
  { label: 'Audit', href: '/audit', icon: '☰' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <span className={styles.hamburger} />
      </button>

      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>●</span>
          <span className={styles.logoText}>Health Coach</span>
          <span className={styles.logoBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerText}>Admin Portal v1.0</div>
        </div>
      </aside>
    </>
  );
}
