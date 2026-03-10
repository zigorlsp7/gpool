'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function AuthCallbackPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { checkAuth } = useAuth();
    const { t } = useI18n();
    const [status, setStatus] = useState(() => t('authCallback.processing'));

    useEffect(() => {
        const processCallback = async () => {
            const transfer = searchParams.get('transfer');
            const signature = searchParams.get('sig');
            const error = searchParams.get('error');

            if (error) {
                console.error('Auth error:', error);
                router.push(`/login?error=${encodeURIComponent(error)}`);
                return;
            }

            if (transfer && signature) {
                setStatus(t('authCallback.authenticating'));
                try {
                    const response = await fetch('/api/auth/session', {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify({
                            transfer,
                            signature,
                        }),
                        cache: 'no-store',
                    });

                    if (!response.ok) {
                        router.push('/login?error=session_creation_failed');
                        return;
                    }

                    const payload = await response.json() as {
                        authenticated?: boolean;
                        redirectPath?: string;
                    };

                    if (!payload.authenticated) {
                        router.push('/login?error=session_creation_failed');
                        return;
                    }

                    await checkAuth();
                    router.replace(payload.redirectPath || '/');
                } catch (error) {
                    console.error('Failed to verify auth after callback:', error);
                    router.push('/login?error=auth_verification_failed');
                }
            } else {
                router.push('/login?error=missing_tokens');
            }
        };

        processCallback();
    }, [searchParams, router, checkAuth, t]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <p>{status}</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    const { t } = useI18n();

    return (
        <Suspense
            fallback={
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <p>{t('authCallback.processing')}</p>
                </div>
            }
        >
            <AuthCallbackPageContent />
        </Suspense>
    );
}
