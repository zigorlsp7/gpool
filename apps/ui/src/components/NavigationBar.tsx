'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';

export function NavigationBar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: `2px solid var(--border-color)`,
        padding: 'var(--spacing-md) var(--spacing-xl)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xl)' }}>
        <Logo size="sm" />

        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center' }}>
          <Link
            href="/pools"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              color: pathname === '/pools' ? 'white' : 'var(--text-primary)',
              fontWeight: pathname === '/pools' ? '600' : '400',
              backgroundColor: pathname === '/pools' ? 'var(--accent-primary)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {t('nav.pools')}
          </Link>
        </div>
      </div>

      {user && (
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: showUserMenu ? 'var(--accent-primary)' : 'transparent',
              color: showUserMenu ? 'white' : 'var(--text-primary)',
              border: `1px solid ${showUserMenu ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
            }}
            onMouseEnter={(e) => {
              if (!showUserMenu) {
                e.currentTarget.style.backgroundColor = 'rgba(67, 86, 99, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showUserMenu) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
            </svg>
            <span>{t('nav.user')}</span>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + var(--spacing-xs))',
                right: 0,
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid var(--border-color)`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '200px',
                zIndex: 1000,
                padding: 'var(--spacing-sm)',
              }}
            >
              <div style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderBottom: `1px solid var(--border-color)`,
                marginBottom: 'var(--spacing-xs)',
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(67, 86, 99, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
