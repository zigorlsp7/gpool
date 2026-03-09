'use client';

import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function LoginPageContent() {
    const { login, isAuthenticated, loading } = useAuth();
    const { t } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, loading, router]);

    useEffect(() => {
        const errorParam = searchParams.get('error');
        if (errorParam) {
            setError(decodeURIComponent(errorParam));
        }
    }, [searchParams]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: 'var(--bg-primary)',
            }}>
                <p style={{ color: 'var(--text-primary)' }}>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--spacing-xl)',
            gap: 'var(--spacing-2xl)',
        }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--spacing-lg)'
            }}>
                <Logo size="lg" />
            </div>

            {error && (
                <div style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: '400px',
                    textAlign: 'center',
                    border: '1px solid #ef9a9a',
                }}>
                    <strong>{t('common.errorLabel')}</strong> {error}
                </div>
            )}

            <button
                onClick={login}
                style={{
                    padding: 'var(--spacing-md) var(--spacing-xl)',
                    fontSize: '1rem',
                    backgroundColor: '#4285f4',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    fontWeight: '500',
                    boxShadow: 'var(--shadow-md)',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
            >
                <svg width="18" height="18" viewBox="0 0 18 18">
                    <path
                        fill="#fff"
                        d="M17.64 9.2c0-.637-.057-1.25-.164-1.84H9v3.48h4.844c-.209 1.18-.843 2.18-1.796 2.85v2.26h2.908c1.702-1.567 2.684-3.874 2.684-6.75z"
                    />
                    <path
                        fill="#34A853"
                        d="M9 18c2.43 0 4.467-.806 5.965-2.18l-2.908-2.26c-.806.54-1.837.86-3.057.86-2.35 0-4.34-1.587-5.053-3.72H.957v2.332C2.438 15.983 5.482 18 9 18z"
                    />
                    <path
                        fill="#FBBC05"
                        d="M3.947 10.72c-.18-.54-.282-1.117-.282-1.72 0-.603.102-1.18.282-1.72V4.948H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.052l2.99-2.332z"
                    />
                    <path
                        fill="#EA4335"
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.948L3.947 7.28C4.66 5.145 6.65 3.58 9 3.58z"
                    />
                </svg>
                {t('login.signInWithGoogle')}
            </button>
        </div>
    );
}

export default function LoginPage() {
    const { t } = useI18n();

    return (
        <Suspense
            fallback={
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <p>{t('common.loading')}</p>
                </div>
            }
        >
            <LoginPageContent />
        </Suspense>
    );
}
