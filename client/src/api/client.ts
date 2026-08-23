import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});
let refreshing: Promise<string | null> | null = null;

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(undefined, async (error) => {
  const original = error.config;
  if (error.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/refresh')) throw error;
  original._retry = true;
  refreshing ??= apiClient.post('/auth/refresh').then(({ data }) => {
    const session = data.data;
    useAuthStore.getState().setSession(session.user, session.accessToken);
    return session.accessToken as string;
  }).catch(() => null).finally(() => { refreshing = null; });
  const accessToken = await refreshing;
  if (!accessToken) throw error;
  original.headers.Authorization = `Bearer ${accessToken}`;
  return apiClient(original);
});

export const api = {
  auth: {
    me: () => apiClient.get('/auth/me'),
    login: (payload: { email: string; password: string }) => apiClient.post('/auth/login', payload),
    register: (payload: { name: string; email: string; password: string }) => apiClient.post('/auth/register', payload),
    refresh: (refreshToken?: string) => apiClient.post('/auth/refresh', refreshToken ? { refreshToken } : undefined),
    logout: (refreshToken?: string) => apiClient.post('/auth/logout', refreshToken ? { refreshToken } : undefined),
    forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
    resetPassword: (payload: { token: string; password: string }) => apiClient.post('/auth/reset-password', payload),
    verifyEmail: (token: string) => apiClient.post('/auth/verify-email', { token }),
    resendVerification: (email: string) => apiClient.post('/auth/resend-verification', { email }),
  },
  skills: { list: (params?: Record<string, unknown>) => apiClient.get('/skills', { params }) },
  users: {
    profile: () => apiClient.get('/profile'),
    publicProfile: (id: string) => apiClient.get(`/users/${encodeURIComponent(id)}`),
    updateProfile: (payload: { name?: string; bio?: string | null; location?: string | null; avatarUrl?: string | null }) => apiClient.put('/profile', payload),
    interests: () => apiClient.get('/profile/interests'),
  },
  recommendations: { users: () => apiClient.get('/recommendations/users') },
  requests: {
    list: () => apiClient.get('/requests'),
    create: (payload: { receiverId: string; skillId: string; message?: string }) => apiClient.post('/requests', payload),
    accept: (id: string) => apiClient.put(`/requests/${encodeURIComponent(id)}/accept`),
    reject: (id: string) => apiClient.put(`/requests/${encodeURIComponent(id)}/reject`),
    cancel: (id: string) => apiClient.put(`/requests/${encodeURIComponent(id)}/cancel`),
    complete: (id: string) => apiClient.put(`/requests/${encodeURIComponent(id)}/complete`),
  },
  conversations: {
    list: () => apiClient.get('/conversations'),
  },
  messages: {
    list: (conversationId: string, params?: Record<string, unknown>) => apiClient.get(`/conversations/${encodeURIComponent(conversationId)}/messages`, { params }),
    markRead: (id: string) => apiClient.put(`/messages/${encodeURIComponent(id)}/read`),
  },
  notifications: {
    list: (params?: Record<string, unknown>) => apiClient.get('/notifications', { params }),
    unreadCount: () => apiClient.get('/notifications/unread-count'),
    markRead: (id: string) => apiClient.put(`/notifications/${encodeURIComponent(id)}/read`),
    markAllRead: () => apiClient.put('/notifications/read-all'),
  },
  admin: {
    dashboard: () => apiClient.get('/admin/dashboard'),
    users: (search?: string) => apiClient.get('/admin/users', { params: search ? { search } : undefined }),
    user: (id: string) => apiClient.get(`/admin/users/${encodeURIComponent(id)}`),
    activateUser: (id: string) => apiClient.put(`/admin/users/${encodeURIComponent(id)}/activate`),
    categories: () => apiClient.get('/admin/categories'),
    auditLogs: (params?: Record<string, unknown>) => apiClient.get('/moderation/audit-logs', { params }),
    reports: () => apiClient.get('/moderation/reports'),
    report: (id: string) => apiClient.get(`/moderation/reports/${encodeURIComponent(id)}`),
    reviewReport: (id: string, payload: { status: string; resolution?: string }) => apiClient.put(`/moderation/reports/${encodeURIComponent(id)}/review`, payload),
    userAction: (id: string, action: 'warn' | 'restrict' | 'suspend' | 'ban', reason?: string) => apiClient.put(`/moderation/users/${encodeURIComponent(id)}/${action}`, { reason }),
  },
};
