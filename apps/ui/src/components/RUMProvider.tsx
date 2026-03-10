'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rum } from '@/lib/rum';

export function RUMProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    // Set user ID for RUM tracking
    if (rum && user) {
      rum.setUserId(user.userId);
    }
  }, [user]);

  return <>{children}</>;
}
