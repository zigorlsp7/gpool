'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface User {
    userId: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => void;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                cache: 'no-store',
            });
            if (!response.ok) {
                setUser(null);
                return;
            }

            const payload = await response.json() as {
                authenticated?: boolean;
                user?: User;
            };

            if (payload.authenticated && payload.user) {
                setUser(payload.user);
            } else {
                setUser(null);
            }
        } catch (error: any) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = () => {
        const redirectPath = encodeURIComponent(window.location.pathname || '/pools');
        window.location.href = `/api/auth/google/start?redirect=${redirectPath}`;
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/session', {
                method: 'DELETE',
                cache: 'no-store',
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            window.location.href = '/login';
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated: !!user,
                checkAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
