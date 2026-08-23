import { ArrowUpRight, CircleHelp, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { EmptyState } from '../components/ui';

const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/dashboard': { eyebrow: 'Your workspace', title: 'Make your next exchange count.', description: 'Your activity and recommendations will appear here once you connect the API.' },
  '/profile': { eyebrow: 'Identity', title: 'Your profile', description: 'Keep your profile current so the right learning partners can find you.' },
  '/profile/edit': { eyebrow: 'Identity', title: 'Edit profile', description: 'Profile editing is ready for the connected API.' },
  '/skills': { eyebrow: 'Your offering', title: 'Skills I teach', description: 'Your active teaching skills will load from the SkillSwap API.' },
  '/discover': { eyebrow: 'Find your match', title: 'Discover people and skills', description: 'Search and matching results will appear here from the live service.' },
  '/requests': { eyebrow: 'Exchange flow', title: 'Skill exchange requests', description: 'Track requests you have sent and received.' },
  '/messages': { eyebrow: 'Conversations', title: 'Messages', description: 'Your accepted exchanges and messages will appear here.' },
  '/notifications': { eyebrow: 'Stay in the loop', title: 'Notifications', description: 'Updates from your exchanges will appear here.' },
  '/settings': { eyebrow: 'Account', title: 'Settings', description: 'Account and notification settings will connect here.' },
  '/admin': { eyebrow: 'Control room', title: 'Admin overview', description: 'Moderation and platform health tools will load from the live service.' },
  '/admin/reports': { eyebrow: 'Control room', title: 'Reports', description: 'Open moderation reports will load from the API.' },
  '/admin/users': { eyebrow: 'Control room', title: 'User management', description: 'User management tools will load from the API.' },
  '/admin/skills': { eyebrow: 'Control room', title: 'Skill management', description: 'Skill management tools will load from the API.' },
  '/admin/categories': { eyebrow: 'Control room', title: 'Categories', description: 'Skill categories will load from the API.' },
};

export default function WorkspacePage() { const path = useLocation().pathname; const copy = pageCopy[path] ?? pageCopy['/dashboard']; return <section className="space-y-8"><div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 lg:flex-row lg:items-end"><div><p className="eyebrow">{copy.eyebrow}</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{copy.title}</h1><p className="mt-3 max-w-2xl text-base text-slate-600">{copy.description}</p></div><Link className="button-primary" to="/discover">Explore <ArrowUpRight size={16} /></Link></div><div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><EmptyState title="Waiting for live data" message="This view does not fabricate records. Connect your API session to populate it." /><div className="rounded-xl bg-slate-950 p-6 text-white"><Sparkles className="text-cyan-300" size={22} /><h2 className="mt-5 font-display text-2xl font-semibold">Exchange with intention.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Pair what you know with what someone else is ready to learn.</p><div className="mt-8 flex items-center gap-2 text-xs text-cyan-200"><CircleHelp size={15} /> Live workspace</div></div></div></section>; }
