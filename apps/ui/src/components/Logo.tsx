'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/i18n/client';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
    const [imageError, setImageError] = useState(false);
    const { t } = useI18n();

    const sizeMap = {
        sm: { width: 40, height: 40, fontSize: '1rem' },
        md: { width: 60, height: 60, fontSize: '1.5rem' },
        lg: { width: 120, height: 120, fontSize: '2rem' },
    };

    const dimensions = sizeMap[size];

    return (
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
            <div
                style={{
                    position: 'relative',
                    width: dimensions.width,
                    height: dimensions.height,
                    flexShrink: 0,
                    borderRadius: '50%',
                    overflow: 'hidden',
                }}
            >
                {!imageError ? (
                    <Image
                        src="/logo.png"
                        alt={t('logo.alt')}
                        width={dimensions.width}
                        height={dimensions.height}
                        style={{
                            objectFit: 'contain',
                            width: '100%',
                            height: '100%',
                        }}
                        priority
                        onError={() => setImageError(true)}
                    />
                ) : (
                    // Fallback if image doesn't exist
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: dimensions.fontSize,
                            boxShadow: 'var(--shadow-md)',
                        }}
                    >
                        GP
                    </div>
                )}
            </div>
        </Link>
    );
}
