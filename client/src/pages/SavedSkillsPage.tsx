import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, Trash2, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState, Toast, useToast } from '../components/ui';

type SavedSkill = { id: string; createdAt: string; skill: { id: string; title: string; description?: string | null; owner: { id: string; name: string }; category?: { name: string } | null } };
const errorText = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Unable to load saved skills.';

export default function SavedSkillsPage() {
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['saved-skills'], queryFn: async () => (await api.skills.saved()).data.data as SavedSkill[] });
  const remove = useMutation({ mutationFn: (skillId: string) => api.skills.unsave(skillId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['saved-skills'] }); toast.notify('Skill removed from saved skills.'); }, onError: (error) => toast.notify(errorText(error)) });
  if (query.isPending) return <LoadingState label="Loading saved skills" />;
  if (query.isError) return <ErrorState message={errorText(query.error)} />;
  return <section className="space-y-9"><header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end"><div><p className="eyebrow">Your shortlist</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950">Saved skills</h1><p className="mt-3 text-slate-600">Keep promising exchange opportunities close at hand.</p></div><Link className="button-primary" to="/discover">Explore skills <ArrowUpRight size={16} /></Link></header>{query.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{query.data.map((item) => <article key={item.id} className="flex min-h-48 flex-col rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><span className="rounded-md bg-cyan-50 p-2 text-cyan-700"><Bookmark size={17} className="fill-current" /></span>{item.skill.category && <span className="text-xs text-slate-400">{item.skill.category.name}</span>}</div><h2 className="mt-5 font-display text-xl font-semibold text-slate-900">{item.skill.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.skill.description || 'No description provided.'}</p><Link className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-cyan-700" to={`/users/${item.skill.owner.id}`}><UserRound size={14} />{item.skill.owner.name}</Link><button className="button-secondary mt-auto" onClick={() => remove.mutate(item.skill.id)} disabled={remove.isPending}><Trash2 size={15} />Remove</button></article>)}</div> : <div><EmptyState title="No saved skills" message="Save skills you are interested in while exploring exchange partners." /><div className="mt-4 flex justify-center"><Link className="button-primary" to="/discover">Explore skills</Link></div></div>}{toast.message && <Toast message={toast.message} onClose={toast.dismiss} />}</section>;
}
