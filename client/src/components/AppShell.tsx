import { Bell, Compass, FileText, Home, LogOut, Menu, MessageCircle, Search, Settings, Shield, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { api } from '../api/client';
import { NotificationBell } from './NotificationBell';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: Home }, { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/skills', label: 'My skills', icon: Search }, { to: '/requests', label: 'Requests', icon: FileText },
  { to: '/messages', label: 'Messages', icon: MessageCircle }, { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound }, { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) { const role = useAuthStore((state) => state.user?.role); return <nav className="space-y-1">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={18} />{label}</NavLink>)}{(role === 'ADMIN' || role === 'MODERATOR') && <NavLink to="/admin" onClick={onNavigate} className="nav-link"><Shield size={18} />Admin</NavLink>}</nav>; }

export function Navbar({ onMenu }: { onMenu: () => void }) { const user = useAuthStore((state) => state.user); const clear = useAuthStore((state) => state.clearSession); const navigate = useNavigate(); return <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8"><button className="icon-button md:hidden" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button><NavLink to="/dashboard" className="font-display text-xl font-bold tracking-tight text-slate-900">Skill<span className="text-cyan-600">Swap</span></NavLink><div className="flex items-center gap-3"><NotificationBell /><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-800">{user?.name ?? 'Member'}</p><p className="text-xs text-slate-500">{user?.email ?? 'Connected account'}</p></div><button className="icon-button" aria-label="Sign out" onClick={() => { void api.auth.logout().catch(() => undefined); clear(); navigate('/login'); }}><LogOut size={18} /></button></div></header>; }
export function Sidebar() { return <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block"><p className="mb-5 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p><NavItems /></aside>; }
export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) { return open ? <div className="fixed inset-0 z-40 md:hidden"><button className="absolute inset-0 bg-slate-950/30" onClick={onClose} aria-label="Close navigation" /><aside className="relative h-full w-72 bg-white p-5 shadow-2xl"><div className="mb-8 flex items-center justify-between"><span className="font-display text-xl font-bold">Skill<span className="text-cyan-600">Swap</span></span><button className="icon-button" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div><NavItems onNavigate={onClose} /></aside></div> : null; }
export function AppShell() { const [mobileOpen, setMobileOpen] = useState(false); return <div className="min-h-screen bg-[#f4f8f7]"><Navbar onMenu={() => setMobileOpen(true)} /><div className="flex"><Sidebar /><main className="min-w-0 flex-1"><div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10"><Outlet /></div></main></div><MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} /></div>; }
