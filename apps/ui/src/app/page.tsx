'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useI18n } from '@/i18n/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function HomeContent() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    // Redirect to pools page immediately
    router.replace('/pools');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}>
      <p style={{ color: 'var(--text-secondary)' }}>{t('home.redirecting')}</p>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
