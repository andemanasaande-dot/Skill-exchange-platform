import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, Check, Flag, MapPin, Pencil, Shield, ShieldOff, Star, UserRound, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState, Modal, Toast, useToast } from '../components/ui';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters.'),
  location: z.string().max(100, 'Location cannot exceed 100 characters.'),
  avatarUrl: z.string().url('Enter a valid image URL.').or(z.literal('')),
});
type Review = { id: string; rating: number; comment?: string | null; createdAt: string; author: { id: string; name: string } };
type Profile = { id: string; name: string; email?: string; bio?: string | null; location?: string | null; avatarUrl?: string | null; role?: string; emailVerified?: boolean; createdAt?: string; reviews?: Review[] };
type Skill = { id: string; title: string; description?: string | null; isActive?: boolean; category?: { id?: string; name: string } | null };
type Interest = { id: string; skill: Skill; interestType: string };
function apiMessage(error: unknown) { return (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Unable to load profile data.'; }

function ProfileHeader({ profile, editable }: { profile: Profile; editable: boolean }) {
  return <div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-100 text-cyan-800">{profile.avatarUrl ? <img className="h-full w-full object-cover" src={profile.avatarUrl} alt={`${profile.name} profile`} /> : <UserRound size={42} />}</div><div className="min-w-0 flex-1"><p className="eyebrow">Profile</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-slate-950">{profile.name}</h1><div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">{profile.location && <span className="flex items-center gap-1.5"><MapPin size={15} />{profile.location}</span>}{profile.email && <span>{profile.email}</span>}</div></div>{editable && <Link to="/profile/edit" className="button-secondary"><Pencil size={15} />Edit profile</Link>}</div>;
}
function Completion({ profile, teaching, learning }: { profile: Profile; teaching: Skill[]; learning: Interest[] }) {
  const complete = [profile.name, profile.bio, profile.location, profile.avatarUrl, teaching.length || learning.length].filter(Boolean).length;
  const percent = Math.round((complete / 5) * 100);
  return <div className="rounded-xl bg-slate-950 p-6 text-white"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Profile completion</p><p className="mt-2 font-display text-3xl font-semibold">{percent}%</p></div><Check className="text-cyan-300" /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${percent}%` }} /></div><p className="mt-4 text-sm text-slate-300">Add the details that help people understand your exchange.</p></div>;
}
function SkillList({ title, skills, interests }: { title: string; skills?: Skill[]; interests?: Interest[] }) {
  const items = skills ?? interests?.map((interest) => interest.skill) ?? [];
  return <div><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-slate-900">{title}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{items.length}</span></div>{items.length ? <div className="grid gap-3 sm:grid-cols-2">{items.map((skill) => <div key={skill.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-800">{skill.title}</h3><span className="text-xs text-slate-400">Proficiency unavailable</span></div>{skill.category && <p className="mt-2 text-xs uppercase tracking-wide text-cyan-700">{skill.category.name}</p>}{skill.description && <p className="mt-2 text-sm text-slate-500">{skill.description}</p>}</div>)}</div> : <EmptyState title="Nothing here yet" message="This profile has not added any skills in this category." />}</div>;
}
function Reviews({ reviews }: { reviews?: Review[] }) {
  if (!reviews?.length) return <EmptyState title="No reviews yet" message="Completed exchange reviews will appear here." />;
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return <section><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-slate-900">Reviews</h2><span className="flex items-center gap-1 text-sm font-semibold text-amber-600"><Star size={15} className="fill-current" />{average.toFixed(1)} ({reviews.length})</span></div><div className="space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-800">{review.author.name}</p><span className="flex items-center gap-1 text-sm text-amber-600"><Star size={14} className="fill-current" />{review.rating}/5</span></div>{review.comment && <p className="mt-2 text-sm leading-6 text-slate-500">{review.comment}</p>}</article>)}</div></section>;
}
function InterestManager() {
  const client = useQueryClient();
  const toast = useToast();
  const interests = useQuery({ queryKey: ['interests'], queryFn: async () => (await api.users.interests()).data.data.skillsToLearn as Interest[] });
  const options = useQuery({ queryKey: ['skills', 'interest-options'], queryFn: async () => (await api.skills.list({ active: true, limit: 100, sort: 'title_asc' })).data.data as Skill[] });
  const add = useMutation({ mutationFn: (skillId: string) => api.users.addInterest(skillId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['interests'] }); toast.notify('Learning interest added.'); }, onError: (error) => toast.notify(apiMessage(error)) });
  const remove = useMutation({ mutationFn: (skillId: string) => api.users.removeInterest(skillId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['interests'] }); toast.notify('Learning interest removed.'); }, onError: (error) => toast.notify(apiMessage(error)) });
  if (interests.isPending || options.isPending) return <LoadingState label="Loading learning interests" />;
  if (interests.isError) return <ErrorState message={apiMessage(interests.error)} />;
  if (options.isError) return <ErrorState message={apiMessage(options.error)} />;
  const selected = new Set(interests.data.map((interest) => interest.skill.id));
  return <section><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-slate-900">Skills I want to learn</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{interests.data.length}</span></div><div className="rounded-xl border border-slate-200 bg-white p-4"><select className="field" defaultValue="" onChange={(event) => { if (event.target.value) { add.mutate(event.target.value); event.target.value = ''; } }} disabled={add.isPending}><option value="">Add a learning interest</option>{options.data.filter((skill) => !selected.has(skill.id)).map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}</select>{interests.data.length ? <div className="mt-4 flex flex-wrap gap-2">{interests.data.map((interest) => <button key={interest.id} className="button-secondary" onClick={() => remove.mutate(interest.skill.id)} disabled={remove.isPending}>{interest.skill.title}<X size={14} /></button>)}</div> : <div className="mt-4"><EmptyState title="No learning interests yet" message="Choose a skill above to add a learning goal." /></div>}</div>{toast.message && <Toast message={toast.message} onClose={toast.dismiss} />}</section>;
}

export function ProfilePage() {
  const query = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.users.profile()).data.data.user as Profile });
  const skills = useQuery({ queryKey: ['skills', 'mine'], queryFn: async () => (await api.skills.list({ owner: query.data?.id, active: true, limit: 100 })).data.data as Skill[], enabled: Boolean(query.data?.id) });
  const interests = useQuery({ queryKey: ['interests'], queryFn: async () => (await api.users.interests()).data.data.skillsToLearn as Interest[] });
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(Boolean(location.state?.profileUpdated));
  useEffect(() => { if (location.state?.profileUpdated) window.history.replaceState({}, document.title); }, [location.state]);
  if (query.isPending || skills.isPending || interests.isPending) return <LoadingState label="Loading your profile" />;
  if (query.isError) return <ErrorState message={apiMessage(query.error)} />;
  if (skills.isError) return <ErrorState message={apiMessage(skills.error)} />;
  if (interests.isError) return <ErrorState message={apiMessage(interests.error)} />;
  const teaching = skills.data ?? [];
  return <section className="space-y-9"><ProfileHeader profile={query.data} editable />{showSuccess && <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Profile updated successfully.<button className="icon-button" onClick={() => setShowSuccess(false)} aria-label="Dismiss success message"><X size={16} /></button></div>}<div className="grid gap-5 lg:grid-cols-[1fr_330px]"><div className="space-y-8"><div><h2 className="font-display text-xl font-semibold text-slate-900">About</h2><p className="mt-3 max-w-2xl whitespace-pre-wrap text-base leading-7 text-slate-600">{query.data.bio || 'No bio added yet.'}</p></div><SkillList title="Skills I teach" skills={teaching} /><InterestManager /><Reviews reviews={query.data.reviews} /></div><Completion profile={query.data} teaching={teaching} learning={interests.data ?? []} /></div></section>;
}

export function PublicProfilePage() {
  const { id } = useParams();
  const client = useQueryClient();
  const toast = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const query = useQuery({ queryKey: ['public-profile', id], queryFn: async () => (await api.users.publicProfile(id!)).data.data.user as Profile, enabled: Boolean(id) });
  const skills = useQuery({ queryKey: ['skills', 'user', id], queryFn: async () => (await api.skills.list({ owner: id, active: true, limit: 100 })).data.data as Skill[], enabled: Boolean(id) });
  const interests = useQuery({ queryKey: ['public-interests', id], queryFn: async () => (await api.users.publicInterests(id!)).data.data.skillsToLearn as Interest[], enabled: Boolean(id) });
  const blockStatus = useQuery({ queryKey: ['block-status', id], queryFn: async () => (await api.users.blockStatus(id!)).data.data.blocked as boolean, enabled: Boolean(id) });
  const block = useMutation({ mutationFn: () => blockStatus.data ? api.users.unblock(id!) : api.users.block(id!), onSuccess: () => { void client.invalidateQueries({ queryKey: ['block-status', id] }); toast.notify(blockStatus.data ? 'User unblocked.' : 'User blocked.'); }, onError: (error) => toast.notify(apiMessage(error)) });
  const report = useMutation({ mutationFn: () => api.moderation.createReport({ targetUserId: id!, reason: reportReason.trim() }), onSuccess: () => { setReportOpen(false); setReportReason(''); toast.notify('Report submitted.'); }, onError: (error) => toast.notify(apiMessage(error)) });
  if (query.isPending || skills.isPending || interests.isPending) return <LoadingState label="Loading profile" />;
  if (query.isError) return <ErrorState message={apiMessage(query.error)} />;
  if (skills.isError) return <ErrorState message={apiMessage(skills.error)} />;
  if (interests.isError) return <ErrorState message={apiMessage(interests.error)} />;
  return <section className="space-y-9"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" to="/discover"><ArrowLeft size={16} />Back to discover</Link><ProfileHeader profile={query.data} editable={false} /><div className="flex flex-wrap gap-3"><button className="button-secondary" onClick={() => block.mutate()} disabled={block.isPending || blockStatus.isPending}>{blockStatus.data ? <><ShieldOff size={15} />Unblock</> : <><Shield size={15} />Block</>}</button><button className="button-secondary" onClick={() => setReportOpen(true)}><Flag size={15} />Report</button></div><div className="grid gap-5 lg:grid-cols-[1fr_330px]"><div><h2 className="font-display text-xl font-semibold text-slate-900">About</h2><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{query.data.bio || 'This member has not added a bio yet.'}</p><div className="mt-9 space-y-8"><SkillList title="Skills I teach" skills={skills.data ?? []} /><SkillList title="Skills I want to learn" interests={interests.data} /><Reviews reviews={query.data.reviews} /></div></div><Completion profile={query.data} teaching={skills.data ?? []} learning={interests.data} /></div><Modal open={reportOpen} title="Report this profile" onClose={() => setReportOpen(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (reportReason.trim().length < 1 || reportReason.trim().length > 500) return; report.mutate(); }}><label className="label">Reason<textarea className="field min-h-28 resize-y" value={reportReason} onChange={(event) => setReportReason(event.target.value)} maxLength={500} placeholder="Tell us what happened" /></label>{report.isError && <ErrorState message={apiMessage(report.error)} />}<button className="button-primary w-full" type="submit" disabled={!reportReason.trim() || report.isPending}>{report.isPending ? 'Submitting...' : 'Submit report'}<Flag size={15} /></button></form></Modal>{toast.message && <Toast message={toast.message} onClose={toast.dismiss} />}</section>;
}

export function EditProfilePage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.users.profile()).data.data.user as Profile });
  const [form, setForm] = useState({ name: '', bio: '', location: '', avatarUrl: '' });
  const [validationError, setValidationError] = useState('');
  useEffect(() => { if (profile.data) setForm({ name: profile.data.name, bio: profile.data.bio ?? '', location: profile.data.location ?? '', avatarUrl: profile.data.avatarUrl ?? '' }); }, [profile.data]);
  const mutation = useMutation({ mutationFn: () => api.users.updateProfile({ ...form, bio: form.bio || null, location: form.location || null, avatarUrl: form.avatarUrl || null }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['profile'] }); navigate('/profile', { state: { profileUpdated: true } }); } });
  if (profile.isPending) return <LoadingState label="Loading profile editor" />;
  if (profile.isError) return <ErrorState message={apiMessage(profile.error)} />;
  const submit = (event: FormEvent) => { event.preventDefault(); const parsed = profileSchema.safeParse(form); if (!parsed.success) { setValidationError(parsed.error.issues[0].message); return; } setValidationError(''); mutation.mutate(); };
  return <section className="mx-auto max-w-2xl space-y-8"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" to="/profile"><ArrowLeft size={16} />Back to profile</Link><div><p className="eyebrow">Identity</p><h1 className="mt-3 font-display text-4xl font-bold text-slate-950">Edit your profile</h1></div><form className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 md:p-8" onSubmit={submit}><label className="label">Name<input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="label">Bio<textarea className="field min-h-32 resize-y" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label><label className="label">Location<input className="field" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="label"><span className="flex items-center gap-2"><Camera size={15} />Profile image URL</span><input className="field" type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} /></label>{validationError && <ErrorState message={validationError} />}{mutation.isError && <ErrorState message={apiMessage(mutation.error)} />}{mutation.isPending ? <LoadingState label="Saving profile" /> : <button className="button-primary w-full" type="submit">Save profile <ArrowRight size={16} /></button>}</form></section>;
}
