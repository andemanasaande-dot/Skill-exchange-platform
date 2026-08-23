import type { ReactNode } from 'react';
import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) { return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} />{label}</div>; }
export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) { return <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><AlertCircle size={18} />{message}</div>; }
export function EmptyState({ title, message }: { title: string; message: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="font-semibold text-slate-800">{title}</h3><p className="mt-2 text-sm text-slate-500">{message}</p></div>; }

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div><div className="mt-5">{children}</div></div></div>;
}
export function ConfirmDialog({ open, title = 'Confirm action', message, onConfirm, onClose }: { open: boolean; title?: string; message: string; onConfirm: () => void; onClose: () => void }) { return <Modal open={open} title={title} onClose={onClose}><p className="text-sm text-slate-600">{message}</p><div className="mt-6 flex justify-end gap-3"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" onClick={onConfirm}><Check size={16} />Confirm</button></div></Modal>; }

export function Toast({ message, onClose }: { message: string; onClose: () => void }) { return <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"><Check size={16} className="text-cyan-300" />{message}<button onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button></div>; }
export function useToast() { const [message, setMessage] = useState<string | null>(null); return { message, notify: setMessage, dismiss: () => setMessage(null) }; }
