'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import { rum } from '@/lib/rum';

function AcceptAccessRequestContent() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { t } = useI18n();

  const poolId = typeof params?.poolId === 'string' ? params.poolId : Array.isArray(params?.poolId) ? params.poolId[0] : '';
  const userId = typeof params?.userId === 'string' ? params.userId : Array.isArray(params?.userId) ? params.userId[0] : '';

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>(() => t('acceptRequest.processingMessage'));

  useEffect(() => {
    // If poolId or userId is missing, bail out gracefully
    if (!poolId || !userId) {
      setStatus('error');
      setMessage(t('acceptRequest.errors.invalidLink'));
      toast.error(t('acceptRequest.errors.invalidLink'));
      return;
    }

    // If user is not yet loaded, wait – ProtectedRoute will handle redirect if needed
    if (!user) {
      return;
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      setStatus('error');
      setMessage(t('acceptRequest.errors.adminOnly'));
      toast.error(t('acceptRequest.errors.adminOnly'));
      return;
    }

    const acceptRequest = async () => {
      try {
        const response = await apiClient.post(`/pools/${poolId}/accept-request/${userId}`);

        const successMessage =
          response.data?.message || t('acceptRequest.success.accepted');

        setStatus('success');
        setMessage(successMessage);
        toast.success(successMessage);

        // Track RUM event
        rum?.trackCustomEvent('Access Request Accepted', {
          poolId,
          targetUserId: userId,
          adminUserId: user.userId,
        });

        // Redirect to pool detail page after a short delay
        setTimeout(() => {
          router.push(`/pools/${poolId}`);
        }, 1500);
      } catch (error: any) {
        // Try to extract a meaningful error message
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t('acceptRequest.errors.acceptFailed');

        setStatus('error');
        setMessage(errorMessage);
        toast.error(errorMessage);

        // Track failure
        rum?.trackCustomEvent('Access Request Accept Failed', {
          poolId,
          targetUserId: userId,
          reason: errorMessage,
        });
      }
    };

    acceptRequest();
  }, [poolId, userId, user, router, t]);

  const heading =
    status === 'pending'
      ? t('acceptRequest.heading.pending')
      : status === 'success'
      ? t('acceptRequest.heading.success')
      : t('acceptRequest.heading.error');

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
          maxWidth: 480,
          width: '100%',
          padding: 'var(--spacing-xl)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: 'var(--spacing-md)',
            color: 'var(--text-primary)',
          }}
        >
          {heading}
        </h1>
        <p
          style={{
            color: status === 'error' ? '#c62828' : 'var(--text-secondary)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          {message}
        </p>
        {status !== 'pending' && (
          <button
            type="button"
            onClick={() => router.push(`/pools/${poolId}`)}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              background:
                status === 'error' ? '#c62828' : 'var(--accent-primary)',
              color: '#fff',
            }}
          >
            {t('acceptRequest.actions.goToPools')}
          </button>
        )}
      </div>
    </main>
  );
}

export default function AcceptAccessRequestPage() {
  return (
    <ProtectedRoute>
      <AcceptAccessRequestContent />
    </ProtectedRoute>
  );
}
