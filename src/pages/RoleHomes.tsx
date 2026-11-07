import { useState } from 'react';
import { useSession } from '../hooks/useSession';
import { useDB } from '../services/store';
import { Icon } from '../components/ui/Icon';
import { Card, SectionTitle } from '../components/ui/primitives';
import { AnimalPhoto } from '../components/Brand';
import { Link, navigate } from '../lib/router';
import { cn, firstName, fmtDate, greeting, timeAgo } from '../lib/utils';
import { isToday } from '../services/queries';

function ScanHero({ label = 'SCAN ANIMAL', sub }: { label?: string; sub: string }) {
  return (
    <Link to="/app/scan" className="flex items-center gap-4 rounded-3xl bg-forest-800 p-5 text-white">
      <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[45%] border-2 border-dashed border-sand-400"><Icon name="scan" size={36} className="text-sand-400" /></span>
      <div><p className="text-2xl font-extrabold tracking-wide">{label}</p><p className="text-sm text-white/75">{sub}</p></div>
    </Link>
  );
}

function QuickSearch() {
  const [q, setQ] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); navigate(`/app/cattle?q=${encodeURIComponent(q)}`); }} className="relative mt-3">
      <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Muzzle ID or ear tag" className="h-14 w-full rounded-2xl border-2 border-charcoal-900/10 bg-white pl-12 pr-4 focus:border-forest-600 focus:outline-none" />
    </form>
  );
}

function Mini({ label, value, cls }: { label: string; value: number | string; cls?: string }) {
  return <div className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/8"><p className={cn('text-3xl font-extrabold', cls)}>{value}</p><p className="text-sm text-charcoal-500">{label}</p></div>;
}

export function VetHome() {
  const { user } = useSession();
  const d = useDB((db) => {
    const mine = db.health.filter((h) => h.recorded_by_id === user!.id).sort((a, b) => b.date.localeCompare(a.date));
    const animalIds = [...new Set(mine.map((h) => h.animal_id))];
    return {
      recent: mine.slice(0, 6).map((h) => ({ h, a: db.animals.find((a) => a.id === h.animal_id)! })).filter((x) => x.a),
      patients: animalIds.length,
      month: mine.filter((h) => new Date(h.date).getMonth() === new Date().getMonth() && new Date(h.date).getFullYear() === new Date().getFullYear()).length,
      attention: animalIds.map((id) => db.animals.find((a) => a.id === id)!).filter((a) => a && a.health_status !== 'HEALTHY'),
    };
  });
  return (
    <div className="fade-up">
      <p className="text-sm font-semibold text-charcoal-500">{user!.organisation}</p>
      <h1 className="mb-4 text-[26px] font-extrabold tracking-tight">{greeting()}, {user!.full_name.startsWith('Dr') ? user!.full_name.split(' ').slice(0, 2).join(' ') : firstName(user!.full_name)}</h1>
      <ScanHero sub="Identify the animal, then add vaccination or treatment" />
      <QuickSearch />
      <div className="mt-4 grid grid-cols-2 gap-3"><Mini label="Animals attended" value={d.patients} /><Mini label="Records this month" value={d.month} cls="text-forest-700" /></div>
      {d.attention.length > 0 && (<>
        <SectionTitle>Follow-up needed</SectionTitle>
        <div className="space-y-2">{d.attention.map((a) => (
          <Link key={a.id} to={`/app/animal/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-300">
            <AnimalPhoto src={a.photo_url} alt="" className="h-12 w-12 rounded-xl" />
            <div className="flex-1"><p className="font-mono text-sm font-bold">{a.muzzle_id}</p><p className="text-xs text-amber-800">{a.health_status === 'UNDER_TREATMENT' ? 'Under treatment' : 'Needs attention'} · {a.region}</p></div>
            <Icon name="chevronRight" className="text-charcoal-400" />
          </Link>))}
        </div>
      </>)}
      <SectionTitle>Your recent records</SectionTitle>
      <div className="space-y-2">{d.recent.map(({ h, a }) => (
        <Link key={h.id} to={`/app/animal/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest-100 text-forest-800"><Icon name={h.type === 'VACCINATION' ? 'syringe' : 'stethoscope'} size={19} /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{h.title}</p><p className="text-xs text-charcoal-500">{a.muzzle_id} · {fmtDate(h.date)}</p></div>
        </Link>))}
      </div>
    </div>
  );
}

export function VerifierHome() {
  const { user } = useSession();
  const d = useDB((db) => {
    const mine = db.scans.filter((s) => s.scanned_by_id === user!.id);
    return {
      today: mine.filter((s) => isToday(s.created_at)).length,
      alerts: mine.filter((s) => s.result === 'ALERT').length,
      open: db.theftReports.filter((t) => t.status === 'OPEN').length,
      recent: mine.slice(0, 8).map((s) => ({ s, a: db.animals.find((a) => a.id === s.animal_id) })),
    };
  });
  return (
    <div className="fade-up">
      <p className="text-sm font-semibold text-charcoal-500">{user!.organisation}</p>
      <h1 className="mb-4 text-[26px] font-extrabold tracking-tight">{greeting()}, {firstName(user!.full_name)}</h1>
      <ScanHero label="VERIFY ANIMAL" sub="Check identity, ownership and theft status" />
      <QuickSearch />
      <div className="mt-4 grid grid-cols-3 gap-2"><Mini label="Scans today" value={d.today} /><Mini label="Alerts raised" value={d.alerts} cls="text-red-600" /><Mini label="Open reports" value={d.open} cls="text-amber-600" /></div>
      <SectionTitle action={<Link to="/app/alerts" className="text-sm font-semibold text-forest-700">Reported list</Link>}>Recent verifications</SectionTitle>
      <Card className="divide-y divide-charcoal-900/6">
        {d.recent.map(({ s, a }) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn('grid h-10 w-10 place-items-center rounded-xl', s.result === 'ALERT' ? 'bg-red-100 text-red-700' : s.result === 'MATCH' ? 'bg-forest-100 text-forest-800' : 'bg-surface text-charcoal-500')}>
              <Icon name={s.result === 'ALERT' ? 'alert' : s.result === 'MATCH' ? 'checkCircle' : 'search'} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold">{a?.muzzle_id ?? 'No match'}</p>
              <p className="text-xs text-charcoal-500">{s.result === 'ALERT' ? 'Stolen/missing alert' : s.result === 'MATCH' ? `Verified · ${s.confidence}% (simulated)` : s.result === 'LOCAL_LOOKUP' ? 'Offline lookup' : 'Not registered'} · {timeAgo(s.created_at)}</p>
            </div>
            {a && <Link to={`/app/animal/${a.id}`} className="text-sm font-semibold text-forest-700">View</Link>}
          </div>
        ))}
      </Card>
    </div>
  );
}
