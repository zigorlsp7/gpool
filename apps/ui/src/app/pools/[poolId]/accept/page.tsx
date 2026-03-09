'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import { rum } from '@/lib/rum';

function AcceptInvitationContent() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { t } = useI18n();

  const poolId = typeof params?.poolId === 'string' ? params.poolId : Array.isArray(params?.poolId) ? params.poolId[0] : '';

  useEffect(() => {
    // If poolId is missing, redirect immediately
    if (!poolId) {
      toast.error(t('acceptInvitation.errors.invalidLink'));
      router.push('/pools');
      return;
    }

    // If user is not yet loaded, wait – ProtectedRoute will handle redirect if needed
    if (!user) {
      return;
    }

    const accept = async () => {
      try {
        const response = await apiClient.post(`/pools/${poolId}/accept-invitation`);

        const successMessage =
          response.data?.message || t('acceptInvitation.success.joined');

        toast.success(successMessage);

        // Track RUM event
        rum?.trackCustomEvent('Invitation Accepted', {
          poolId,
          userId: user.userId,
          email: user.email,
        });

        // Redirect immediately to pool detail page
        window.location.href = `/pools/${poolId}`;
      } catch (error: any) {
        // Try to extract a meaningful error message
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t('acceptInvitation.errors.acceptFailed');

        toast.error(errorMessage);

        // Track failure
        rum?.trackCustomEvent('Invitation Accept Failed', {
          poolId,
          reason: errorMessage,
        });

        // Redirect to pools even on error
        window.location.href = '/pools';
      }
    };

    accept();
  }, [poolId, user, router, t]);

  // Show minimal loading state while processing
  return (
    <main
      style={{
        padding: 'var(--spacing-2xl)',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>{t('acceptInvitation.processing')}</p>
      </div>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <ProtectedRoute>
      <AcceptInvitationContent />
    </ProtectedRoute>
  );
}
