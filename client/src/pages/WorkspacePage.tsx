import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, Check, CircleHelp, Pencil, Plus, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api/client';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Modal, Toast, useToast } from '../components/ui';
import { useAuthStore } from '../store/auth.store';

type Skill = { id: string; title: string; description?: string | null; categoryId?: string; category?: { id?: string; name: string } | null; isActive: boolean };
type Category = { id: string; name: string; slug: string };
type Interest = { id: string; skill: Skill };
type DashboardRequest = { id: string; senderId: string; receiverId: string; status: string; createdAt: string; updatedAt?: string; sender: { name: string }; receiver: { name: string }; skill: { title: string } };
type DashboardConversation = { id: string; updatedAt: string; userAId: string; userA: { name: string }; userB: { name: string }; request: { skill: { title: string } } };
type Recommendation = { user: { id: string; name: string; bio?: string | null }; explanation: string; score: number; matchedTeachingSkill: { title: string }; matchedLearningInterest: { skill: { title: string } } };

const errorText = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Unable to load workspace data.';
const skillSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters.').max(100),
  description: z.string().max(500),
  categoryId: z.string().min(1, 'Choose a category.'),
});

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 lg:flex-row lg:items-end"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-base text-slate-600">{description}</p></div><Link className="button-primary" to="/discover">Explore <ArrowUpRight size={16} /></Link></header>;
}

function Metric({ label, value, to }: { label: string; value: number; to: string }) {
  return <Link to={to} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-cyan-300 hover:shadow-md"><p className="font-display text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></Link>;
}

function DashboardPage() {
  const userId = useAuthStore((state) => state.user?.id) ?? '';
  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await api.users.profile()).data.data.user as { name: string } });
  const skills = useQuery({ queryKey: ['skills', 'mine'], queryFn: async () => (await api.skills.list({ owner: userId, active: true, limit: 100 })).data.data as Skill[], enabled: Boolean(userId) });
  const interests = useQuery({ queryKey: ['interests'], queryFn: async () => (await api.users.interests()).data.data.skillsToLearn as Interest[] });
  const requests = useQuery({ queryKey: ['requests'], queryFn: async () => (await api.requests.list()).data.data as DashboardRequest[], enabled: Boolean(userId) });
  const notifications = useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: async () => (await api.notifications.unreadCount()).data.data.count });
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: async () => (await api.conversations.list()).data.data as DashboardConversation[] });
  const recommendations = useQuery({ queryKey: ['recommendations', 'users'], queryFn: async () => (await api.recommendations.users()).data.data as Recommendation[] });

  const queries = [profile, skills, interests, requests, notifications, conversations, recommendations];
  if (queries.some((query) => query.isPending)) return <LoadingState label="Loading your dashboard" />;
  const failed = queries.find((query) => query.isError);
  if (failed?.isError) return <ErrorState message={errorText(failed.error)} />;

  const requestItems = requests.data ?? [];
  const incoming = requestItems.filter((item) => item.receiverId === userId && item.status === 'PENDING');
  const outgoing = requestItems.filter((item) => item.senderId === userId && item.status === 'PENDING');
  const accepted = requestItems.filter((item) => item.status === 'ACCEPTED');
  const activity = [
    ...requestItems.map((item) => ({
      id: `request-${item.id}`,
      date: new Date(item.updatedAt ?? item.createdAt),
      label: `Request ${item.status.toLowerCase()}`,
      detail: item.skill.title,
    })),
    ...(conversations.data ?? []).map((item) => ({
      id: `conversation-${item.id}`,
      date: new Date(item.updatedAt),
      label: 'Conversation updated',
      detail: item.request.skill.title,
    })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime()).slice(0, 5);

  return <section className="space-y-9"><Header eyebrow="Your workspace" title={`Welcome back, ${profile.data?.name ?? 'member'}.`} description="A live view of your exchange activity and learning goals." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Skills I teach" value={skills.data?.length ?? 0} to="/skills" /><Metric label="Skills to learn" value={interests.data?.length ?? 0} to="/profile" /><Metric label="Incoming requests" value={incoming.length} to="/requests" /><Metric label="Outgoing requests" value={outgoing.length} to="/requests" /><Metric label="Accepted exchanges" value={accepted.length} to="/requests" /><Metric label="Unread notifications" value={notifications.data ?? 0} to="/notifications" /><Metric label="Conversations" value={conversations.data?.length ?? 0} to="/messages" /></div><div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><div className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Next step</p><h2 className="mt-2 font-display text-2xl font-semibold text-slate-950">Keep your exchange moving.</h2></div><BookOpen className="text-cyan-600" size={22} /></div><p className="mt-4 text-sm leading-6 text-slate-600">Browse live skills and connect with people whose goals complement what you teach.</p><Link className="button-primary mt-6" to="/discover">Find a match <ArrowUpRight size={16} /></Link></div><div className="rounded-xl bg-slate-950 p-6 text-white"><Sparkles className="text-cyan-300" size={22} /><h2 className="mt-5 font-display text-2xl font-semibold">Exchange with intention.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Your counts and activity above come directly from the SkillSwap API.</p><div className="mt-8 flex items-center gap-2 text-xs text-cyan-200"><CircleHelp size={15} /> Live workspace</div></div></div><div className="grid gap-5 lg:grid-cols-2">{activity.length ? <section className="rounded-xl border border-slate-200 bg-white p-6"><p className="eyebrow">Recent activity</p><ul className="mt-5 space-y-4">{activity.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"><div><p className="text-sm font-medium text-slate-900">{item.label}</p><p className="mt-1 text-sm text-slate-500">{item.detail}</p></div><time className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</time></li>)}</ul></section> : <section className="rounded-xl border border-slate-200 bg-white p-6"><p className="eyebrow">Recent activity</p><p className="mt-4 text-sm text-slate-500">No activity yet. Start by adding a skill or sending a request.</p></section>}<section className="rounded-xl border border-slate-200 bg-white p-6"><p className="eyebrow">Recommendations</p><div className="mt-5 space-y-4">{(recommendations.data ?? []).slice(0, 3).map((recommendation) => <div key={`${recommendation.user.id}-${recommendation.matchedTeachingSkill.title}`} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-900">{recommendation.user.name}</p><p className="mt-2 text-sm text-slate-600">{recommendation.explanation}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Match score: {Math.round(recommendation.score * 100)}%</span><span>{recommendation.matchedTeachingSkill.title}</span></div></div>)}</div></section></div></section>;
}

function SkillEditor({ skill, categories, onClose, onSaved }: { skill: Skill | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: skill?.title ?? '', description: skill?.description ?? '', categoryId: skill?.categoryId ?? skill?.category?.id ?? '' });
  const [validationError, setValidationError] = useState('');

  const resetForm = () => {
    setForm({ title: skill?.title ?? '', description: skill?.description ?? '', categoryId: skill?.categoryId ?? skill?.category?.id ?? '' });
    setValidationError('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (skill) return api.skills.update(skill.id, form);
      return api.skills.create(form);
    },
    onSuccess: () => {
      toast.notify(skill ? 'Skill updated successfully.' : 'Skill created successfully.');
      onSaved();
      onClose();
    },
    onError: (error) => toast.notify(errorText(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = skillSchema.safeParse(form);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message);
      return;
    }
    setValidationError('');
    mutation.mutate();
  };

  return <>
    <Modal open title={skill ? 'Edit skill' : 'Add a skill'} onClose={() => { resetForm(); onClose(); }}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="label">Title
          <input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="label">Description
          <textarea className="field min-h-24 resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <label className="label">Category
          <select className="field" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">Select a category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {validationError && <ErrorState message={validationError} />}
        <div className="flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => { resetForm(); onClose(); }}><X size={15} />Cancel</button>
          <button className="button-primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save skill'}<Check size={15} /></button>
        </div>
      </form>
    </Modal>
    {toast.message && <Toast message={toast.message} onClose={toast.dismiss} />}
  </>;
}

function SkillsPage() {
  const userId = useAuthStore((state) => state.user?.id) ?? '';
  const client = useQueryClient();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [selectedInterest, setSelectedInterest] = useState('');

  const skills = useQuery({ queryKey: ['skills', 'mine'], queryFn: async () => (await api.skills.list({ owner: userId, active: true, limit: 100, sort: 'title_asc' })).data.data as Skill[], enabled: Boolean(userId) });
  const interests = useQuery({ queryKey: ['interests'], queryFn: async () => (await api.users.interests()).data.data.skillsToLearn as Interest[] });
  const categories = useQuery({ queryKey: ['skill-categories'], queryFn: async () => (await api.skills.categories()).data.data as Category[] });
  const allSkills = useQuery({ queryKey: ['skills', 'interest-options'], queryFn: async () => (await api.skills.list({ active: true, limit: 100, sort: 'title_asc' })).data.data as Skill[] });

  const remove = useMutation({
    mutationFn: (id: string) => api.skills.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['skills'] });
      setDeleting(null);
      toast.notify('Skill deleted successfully.');
    },
    onError: (error) => toast.notify(errorText(error)),
  });

  const addInterest = useMutation({
    mutationFn: (skillId: string) => api.users.addInterest(skillId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interests'] });
      setSelectedInterest('');
      toast.notify('Learning interest added.');
    },
    onError: (error) => toast.notify(errorText(error)),
  });

  const removeInterest = useMutation({
    mutationFn: (skillId: string) => api.users.removeInterest(skillId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interests'] });
      toast.notify('Learning interest removed.');
    },
    onError: (error) => toast.notify(errorText(error)),
  });

  if (skills.isPending || interests.isPending || categories.isPending || allSkills.isPending) return <LoadingState label="Loading your skills" />;
  const failed = [skills, interests, categories, allSkills].find((query) => query.isError);
  if (failed?.isError) return <ErrorState message={errorText(failed.error)} />;

  const currentInterestIds = new Set((interests.data ?? []).map((interest) => interest.skill.id));

  return <>
    <section className="space-y-9">
      <Header eyebrow="Your offering" title="Skills I teach" description="Keep your teaching skills current so the right exchange partners can find you." />
      <div className="flex justify-end">
        <button className="button-primary" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={16} />Add skill</button>
      </div>

      {skills.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.data.map((skill) => (
            <article key={skill.id} className="flex min-h-48 flex-col rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md bg-cyan-50 p-2 text-cyan-700"><BookOpen size={17} /></span>
                <span className="text-xs font-medium text-emerald-600">Active</span>
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold text-slate-900">{skill.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{skill.description || 'No description provided.'}</p>
              <p className="mt-auto pt-5 text-xs text-slate-400">{skill.category?.name ?? 'Uncategorized'}</p>
              <div className="mt-4 flex gap-2">
                <button className="button-secondary" onClick={() => { setEditing(skill); setEditorOpen(true); }}><Pencil size={15} />Edit</button>
                <button className="icon-button" onClick={() => setDeleting(skill)} aria-label={`Delete ${skill.title}`}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No skills yet" message="Add a skill you can teach to start finding reciprocal exchanges." />}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Learning goals</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-950">Skills I want to learn</h2>
          </div>
          <UserRound className="text-cyan-600" size={21} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className="field" value={selectedInterest} onChange={(event) => {
              const skillId = event.target.value;
              setSelectedInterest(skillId);
              if (skillId) addInterest.mutate(skillId);
            }}>
              <option value="">Select a skill to learn</option>
              {(allSkills.data ?? []).filter((skill) => !currentInterestIds.has(skill.id) && skill.isActive).map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.title}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {interests.data?.length ? interests.data.map((interest) => (
              <div key={interest.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">{interest.skill.title}</span>
                <button className="button-secondary" onClick={() => removeInterest.mutate(interest.skill.id)}>Remove</button>
              </div>
            )) : <p className="text-sm text-slate-500">No learning interests yet.</p>}
          </div>
        </div>
      </section>
    </section>

    {editorOpen && (
      <SkillEditor
        skill={editing}
        categories={categories.data ?? []}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onSaved={() => {
          void client.invalidateQueries({ queryKey: ['skills'] });
          void client.invalidateQueries({ queryKey: ['interests'] });
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    )}

    {toast.message && <Toast message={toast.message} onClose={toast.dismiss} />}
    <ConfirmDialog
      open={Boolean(deleting)}
      title="Delete skill"
      message={`Delete ${deleting?.title ?? 'this skill'}? This action cannot be undone.`}
      onConfirm={() => {
        if (!deleting) return;
        remove.mutate(deleting.id);
      }}
      onClose={() => setDeleting(null)}
    />
  </>;
}

function SettingsPage() {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.users.profile()).data.data.user as { name: string; email: string; emailVerified: boolean; role: string; status: string },
  });

  if (query.isPending) return <LoadingState label="Loading account settings" />;
  if (query.isError) return <ErrorState message={errorText(query.error)} />;

  return <section className="space-y-9"><Header eyebrow="Account" title="Settings" description="Review your account details and update your profile information." /><div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><UserRound className="text-cyan-600" size={22} /><div><h2 className="font-display text-xl font-semibold text-slate-900">Account details</h2><p className="text-sm text-slate-500">{query.data.email}</p></div></div><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Name</dt><dd className="mt-1 text-sm text-slate-700">{query.data.name}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Role</dt><dd className="mt-1 text-sm text-slate-700">{query.data.role}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-1 text-sm text-slate-700">{query.data.status}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Email verification</dt><dd className="mt-1 text-sm text-slate-700">{query.data.emailVerified ? 'Verified' : 'Not verified'}</dd></div></dl><Link className="button-primary mt-7" to="/profile/edit"><Pencil size={15} />Edit profile</Link></div></section>;
}

export default function WorkspacePage() {
  const path = useLocation().pathname;
  if (path === '/skills') return <SkillsPage />;
  if (path === '/settings') return <SettingsPage />;
  return <DashboardPage />;
}
