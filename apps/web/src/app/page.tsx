'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function HomeContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <main style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Football Pool Management System</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user && (
            <>
              <span>Welcome, {user.email}</span>
              <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      <p>Welcome to the Football Pool Management Platform</p>
      {user && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Your Profile</h2>
          <p>User ID: {user.userId}</p>
          <p>Email: {user.email}</p>
          <p>Role: {user.role}</p>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
