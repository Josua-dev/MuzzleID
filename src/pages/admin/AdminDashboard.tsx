import { useState } from 'react';
import { asset } from '../../lib/assets';
import { Button, Card, Input, ProtoTag, Select, Sheet, StatusBadge, toast } from '../../components/ui/primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import { BarChart, Donut, HBars } from '../../components/Charts';
import { AnimalPhoto } from '../../components/Brand';
import { useSession } from '../../hooks/useSession';
import { useDB } from '../../services/store';
import { isToday, getUser } from '../../services/queries';
import { createPrototypeUser, reviewRegistration, setUserActive } from '../../services/actions';
import { describe, TONE_CLS } from '../../lib/activity';
import { ROLE_LABEL } from '../../lib/permissions';
import { Link } from '../../lib/router';
import { cn, fmtDate, fmtDateTime } from '../../lib/utils';
import type { AuditLog, Role } from '../../types/models';

type Tab = 'overview' | 'users' | 'registrations' | 'reports' | 'activity';
const TABS: { k: Tab; label: string; icon: IconName }[] = [
  { k: 'overview', label: 'Overview', icon: 'chart' }, { k: 'users', label: 'Users', icon: 'users' },
  { k: 'registrations', label: 'Registrations', icon: 'fingerprint' }, { k: 'reports', label: 'Reports', icon: 'alert' },
  { k: 'activity', label: 'Activity log', icon: 'activity' },
];

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/8">
      <div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon name={icon} size={18} /></span></div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-charcoal-500">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Admin dashboard</h1><p className="text-sm text-charcoal-500">System overview</p></div>
        <ProtoTag>Demo data</ProtoTag>
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cn('flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold', tab === t.k ? 'bg-forest-800 text-white' : 'bg-white text-charcoal-700 ring-1 ring-charcoal-900/10')}>
            <Icon name={t.icon} size={16} />{t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'registrations' && <Registrations />}
      {tab === 'reports' && <Reports />}
      {tab === 'activity' && <Activity />}
    </div>
  );
}

function Overview() {
  const s = useDB((d) => {
    const months = Array.from({ length: 12 }, (_, i) => { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - (11 - i)); return t; });
    const count = <T,>(arr: T[], key: (x: T) => string) => { const m = new Map<string, number>(); arr.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1)); return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); };
    return {
      animals: d.animals.length,
      farmers: d.users.filter((u) => u.role === 'FARMER' && u.active).length,
      scansToday: d.scans.filter((x) => isToday(x.created_at)).length,
      reports: d.theftReports.filter((r) => r.status === 'OPEN').length,
      verified: d.scans.filter((x) => x.result === 'MATCH' || x.result === 'ALERT').length,
      byMonth: months.map((m) => ({ label: m.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3), value: d.animals.filter((a) => { const c = new Date(a.created_at); return c.getMonth() === m.getMonth() && c.getFullYear() === m.getFullYear(); }).length })),
      byRegion: count(d.animals, (a) => a.region),
      byBreed: count(d.animals, (a) => a.breed),
      byStatus: (['ACTIVE', 'MISSING', 'STOLEN', 'TRANSFER_PENDING'] as const).map((k) => ({ label: k === 'TRANSFER_PENDING' ? 'Transfer pending' : k.charAt(0) + k.slice(1).toLowerCase(), value: d.animals.filter((a) => a.status === k).length, color: { ACTIVE: '#23643f', MISSING: '#f59e0b', STOLEN: '#dc2626', TRANSFER_PENDING: '#2563eb' }[k] })),
      recent: d.audit.filter((l) => !l.action.startsWith('SIGNED_IN')).slice(0, 8),
    };
  });
  const palette = ['#143d29', '#2f7d4f', '#c8955a', '#8f6430', '#6b716d', '#c4dccb', '#1c1f1d'];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Registered animals" value={s.animals} icon="cow" tone="bg-forest-800 text-white" />
        <StatCard label="Active farmers" value={s.farmers} icon="users" tone="bg-forest-100 text-forest-800" />
        <StatCard label="Scans today" value={s.scansToday} icon="scan" tone="bg-sand-100 text-sand-700" />
        <StatCard label="Missing / stolen reports" value={s.reports} icon="alert" tone="bg-red-100 text-red-700" />
        <StatCard label="Successful verifications" value={s.verified} icon="shieldCheck" tone="bg-blue-100 text-blue-700" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><p className="mb-3 font-bold">Livestock registrations over time</p><BarChart data={s.byMonth} /></Card>
        <Card className="p-5"><p className="mb-3 font-bold">Livestock by region</p><HBars data={s.byRegion} /></Card>
        <Card className="p-5"><p className="mb-3 font-bold">Breed distribution</p><Donut data={s.byBreed.map((b, i) => ({ ...b, color: palette[i % palette.length] }))} /></Card>
        <Card className="p-5"><p className="mb-3 font-bold">Status distribution</p><Donut data={s.byStatus} /></Card>
      </div>
      <Card className="overflow-x-auto">
        <p className="px-5 pt-4 font-bold">Recent activity</p>
        <ActivityTable logs={s.recent} />
      </Card>
      <p className="text-xs text-charcoal-500">All figures are calculated from fictional demo records stored in this prototype.</p>
    </div>
  );
}

function ActivityTable({ logs }: { logs: AuditLog[] }) {
  return (
    <table className="mt-2 w-full min-w-[560px] text-left text-sm">
      <thead><tr className="border-b border-charcoal-900/8 text-xs uppercase tracking-wider text-charcoal-500"><th className="px-5 py-2">Event</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-5 py-2 text-right">Time</th></tr></thead>
      <tbody>
        {logs.map((l) => { const d = describe(l); return (
          <tr key={l.id} className="border-b border-charcoal-900/6 last:border-0">
            <td className="px-5 py-2.5"><span className="flex items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONE_CLS[d.tone]}`}><Icon name={d.icon} size={14} /></span>{d.text}</span></td>
            <td className="px-3 py-2.5">{l.actor_name}</td>
            <td className="px-3 py-2.5 text-charcoal-500">{l.actor_role === 'SYSTEM' ? 'System' : ROLE_LABEL[l.actor_role]}</td>
            <td className="whitespace-nowrap px-5 py-2.5 text-right text-charcoal-500">{fmtDateTime(l.created_at)}</td>
          </tr>); })}
      </tbody>
    </table>
  );
}

function Users() {
  const { user } = useSession();
  const users = useDB((d) => d.users.map((u) => ({ u, animals: d.animals.filter((a) => a.owner_id === u.id).length })));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ full_name: string; phone: string; role: Role; organisation: string }>({ full_name: '', phone: '+264 ', role: 'VERIFIER', organisation: '' });
  return (
    <div className="space-y-3">
      <div className="flex justify-between"><p className="text-sm text-charcoal-500">{users.length} prototype users</p><Button size="md" icon="plus" onClick={() => setOpen(true)}>Add user</Button></div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b border-charcoal-900/8 text-xs uppercase tracking-wider text-charcoal-500"><th className="px-4 py-3">Name</th><th className="px-3">Role</th><th className="px-3">Phone</th><th className="px-3">Animals</th><th className="px-3">Status</th><th className="px-4 text-right">Action</th></tr></thead>
          <tbody>
            {users.map(({ u, animals }) => (
              <tr key={u.id} className="border-b border-charcoal-900/6 last:border-0">
                <td className="px-4 py-3 font-semibold">{u.full_name}{u.organisation && <div className="text-xs font-normal text-charcoal-500">{u.organisation}</div>}</td>
                <td className="px-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-3 text-charcoal-500">{u.phone}</td>
                <td className="px-3">{u.role === 'FARMER' ? animals : '—'}</td>
                <td className="px-3"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', u.active ? 'bg-forest-100 text-forest-800' : 'bg-surface text-charcoal-500')}>{u.active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 text-right">{u.id !== user!.id && <button onClick={() => { setUserActive(user!, u.id, !u.active); toast(u.active ? 'User deactivated' : 'User activated'); }} className="text-sm font-semibold text-forest-700">{u.active ? 'Deactivate' : 'Activate'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add prototype user">
        <div className="space-y-3">
          <Input label="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} options={[{ value: 'VERIFIER', label: 'Verification user' }, { value: 'VET', label: 'Veterinary user' }, { value: 'ADMIN', label: 'Administrator' }]} />
          <Input label="Organisation" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} />
          <p className="text-xs text-charcoal-500">Prototype: the new user can sign in with this phone and password <b className="font-mono">demo1234</b>.</p>
          <Button full disabled={!f.full_name || f.phone.replace(/\D/g, '').length < 9} onClick={() => { createPrototypeUser(user!, f); setOpen(false); toast('User created'); }}>Create user</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Registrations() {
  const { user } = useSession();
  const rows = useDB((d) => d.animals.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => {
    const rev = d.audit.find((l) => l.target === a.muzzle_id && (l.action === 'REGISTRATION_REVIEWED' || l.action === 'REGISTRATION_FLAGGED'));
    const dup = d.notifications.some((n) => n.animal_id === a.id && n.title.startsWith('Possible duplicate'));
    return { a, owner: getUser(d, a.owner_id)?.full_name, review: rev?.action === 'REGISTRATION_REVIEWED' ? 'Reviewed' : rev ? 'Flagged' : a.is_demo ? 'Reviewed' : 'Awaiting review', dup, bio: d.biometrics.find((b) => b.animal_id === a.id) };
  }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(({ a, owner, review, dup, bio }) => (
        <Card key={a.id} className="p-3">
          <div className="flex gap-3">
            <AnimalPhoto src={a.photo_url} alt="" className="h-16 w-16 rounded-xl" />
            {bio?.reference_image && <img src={asset(bio.reference_image)} alt="Muzzle" className="h-16 w-16 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <Link to={`/app/animal/${a.id}`} className="font-mono text-sm font-bold text-forest-800">{a.muzzle_id}</Link>
              <p className="truncate text-xs text-charcoal-500">{a.breed} · {owner} · {fmtDate(a.created_at)}</p>
              <p className="text-xs text-charcoal-500">Enrolment quality: {bio?.enrollment_quality ? `${Math.round(bio.enrollment_quality * 100)}%` : 'pending'}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', review === 'Reviewed' ? 'bg-forest-100 text-forest-800' : review === 'Flagged' ? 'bg-red-100 text-red-700' : 'bg-sand-100 text-sand-700')}>{review}</span>
                {dup && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Possible duplicate</span>}
              </div>
            </div>
          </div>
          {review === 'Awaiting review' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="md" variant="outline" onClick={() => { reviewRegistration(user!, a.id, 'FLAGGED'); toast('Registration flagged', 'warn'); }}>Flag</Button>
              <Button size="md" icon="check" onClick={() => { reviewRegistration(user!, a.id, 'REVIEWED'); toast('Marked as reviewed'); }}>Reviewed</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Reports() {
  const rows = useDB((d) => d.theftReports.slice().sort((a, b) => b.reported_at.localeCompare(a.reported_at)).map((r) => ({ r, a: d.animals.find((a) => a.id === r.animal_id)!, by: getUser(d, r.reported_by_id)?.full_name, scans: d.scans.filter((s) => s.animal_id === r.animal_id && s.result === 'ALERT').length })));
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead><tr className="border-b border-charcoal-900/8 text-xs uppercase tracking-wider text-charcoal-500"><th className="px-4 py-3">Animal</th><th className="px-3">Type</th><th className="px-3">Reported</th><th className="px-3">By</th><th className="px-3">Last seen</th><th className="px-3">Alert scans</th><th className="px-4">Status</th></tr></thead>
        <tbody>
          {rows.map(({ r, a, by, scans }) => (
            <tr key={r.id} className="border-b border-charcoal-900/6 last:border-0">
              <td className="px-4 py-3"><Link to={`/app/animal/${a.id}`} className="font-mono font-bold text-forest-800">{a.muzzle_id}</Link><div className="text-xs text-charcoal-500">{a.breed}</div></td>
              <td className="px-3"><StatusBadge status={r.type} /></td>
              <td className="px-3">{fmtDate(r.reported_at)}</td>
              <td className="px-3">{by}</td>
              <td className="px-3 text-charcoal-500">{r.last_seen_location}</td>
              <td className="px-3 font-bold">{scans}</td>
              <td className="px-4"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', r.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-forest-100 text-forest-800')}>{r.status === 'OPEN' ? 'Open' : `Resolved ${fmtDate(r.resolved_at)}`}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Activity() {
  const [q, setQ] = useState('');
  const logs = useDB((d) => d.audit);
  const shown = logs.filter((l) => !q || `${describe(l).text} ${l.actor_name} ${l.action} ${l.details ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 100);
  return (
    <div className="space-y-3">
      <Input placeholder="Filter by user, MuzzleID or action" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-x-auto"><ActivityTable logs={shown} /></Card>
      <p className="text-xs text-charcoal-500">Audit log: {logs.length} entries. Includes sign-ins, registrations, scans, health records, transfers, reports and admin actions.</p>
    </div>
  );
}
