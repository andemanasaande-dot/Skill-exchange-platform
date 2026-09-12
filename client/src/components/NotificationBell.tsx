import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api } from '../api/client';
import { useNotificationRealtime } from '../hooks/useNotificationRealtime';
import { useAuthStore } from '../store/auth.store';

type Notification = { id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string };
const notificationIcon = (type: string) => type.startsWith('REQUEST') ? 'Request' : type === 'NEW_MESSAGE' ? 'Message' : type === 'MODERATION' ? 'Moderation' : 'System';
const errorText = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Unable to update notification.';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const client = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const count = useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: async () => (await api.notifications.unreadCount()).data.data.count });
  const recent = useQuery({ queryKey: ['notifications', 'recent'], queryFn: async () => (await api.notifications.list({ page: 1, limit: 5 })).data.data as Notification[], enabled: open });
  const read = useMutation({ mutationFn: (id: string) => api.notifications.markRead(id), onSuccess: () => { void client.invalidateQueries({ queryKey: ['notifications'] }); void client.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }); }, onError: (error) => client.setQueryData(['notifications', 'bell-error'], errorText(error)) });
  useEffect(() => { if (!token) return; const nextSocket = io(new URL(import.meta.env.VITE_API_URL || '/api/v1', window.location.origin).origin, { auth: { token }, reconnection: true }); setSocket(nextSocket); return () => { nextSocket.disconnect(); setSocket(null); }; }, [token]);
  useNotificationRealtime(socket, client);
  return <div className="relative"><button className="icon-button relative" aria-label={`Notifications${count.data ? `, ${count.data} unread` : ''}`} onClick={() => setOpen(!open)}><Bell size={18} />{Boolean(count.data) && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold text-white">{count.data > 99 ? '99+' : count.data}</span>}</button>{open && <div className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Notifications</h2><Link className="text-xs font-semibold text-cyan-700" to="/notifications" onClick={() => setOpen(false)}>View all</Link></div>{recent.isPending ? <p className="p-5 text-sm text-slate-500">Loading notifications...</p> : recent.isError ? <p className="p-5 text-sm text-rose-600">Unable to load notifications.</p> : recent.data?.length ? <div>{recent.data.map((item) => <button key={item.id} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${item.isRead ? '' : 'bg-cyan-50/40'}`} onClick={() => { if (!item.isRead) read.mutate(item.id); }}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{notificationIcon(item.type)} · {new Date(item.createdAt).toLocaleString()}</p></div>{!item.isRead && <ChevronRight size={15} className="mt-1 shrink-0 text-cyan-600" />}</div><p className="mt-2 text-xs leading-5 text-slate-500">{item.body}</p></button>)}</div> : <p className="p-5 text-sm text-slate-500">No new notifications.</p>}</div>}</div>;
}
