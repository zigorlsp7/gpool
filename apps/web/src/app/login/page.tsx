'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      gap: '2rem'
    }}>
      <h1>Welcome to GPool</h1>
      <p>Sign in to continue</p>
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          maxWidth: '400px',
          textAlign: 'center'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      <button
        onClick={login}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
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
        Sign in with Google
      </button>
    </div>
  );
}
