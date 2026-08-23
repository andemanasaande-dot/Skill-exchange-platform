import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { LoadingState } from './ui';
import { useEffect } from 'react';

export function ProtectedRoute() { const token = useAuthStore((state) => state.accessToken); const clear = useAuthStore((state) => state.clearSession); const setSession = useAuthStore((state) => state.setSession); const location = useLocation(); const query = useQuery({ queryKey: ['current-user'], queryFn: async () => (await api.auth.me()).data.data.user, enabled: Boolean(token), retry: false }); useEffect(() => { if (query.data && token) setSession(query.data, token); if (query.error && (query.error as { response?: { status?: number } }).response?.status === 401) clear(); }, [query.data, query.error, token, setSession, clear]); if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />; if (query.isPending) return <main className="flex min-h-screen items-center justify-center bg-[#f4f8f7] p-6"><LoadingState label="Restoring your session" /></main>; if (query.isError) return <Navigate to="/login" replace state={{ from: location.pathname }} />; return <Outlet />; }
export function RoleProtectedRoute({ roles }: { roles: string[] }) { const user = useAuthStore((state) => state.user); if (!user) return <Navigate to="/login" replace />; return user.role && roles.includes(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />; }
