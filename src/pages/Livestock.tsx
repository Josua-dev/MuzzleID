import { useState } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { AnimalCard } from '../components/AnimalCard';
import { Button, EmptyState } from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { useSession } from '../hooks/useSession';
import { useDB } from '../services/store';
import { displayStatus, herdFor, searchAnimals } from '../services/queries';
import { cn } from '../lib/utils';
import { navigate, useRoute } from '../lib/router';
import type { DisplayStatus } from '../types/models';

const FILTERS: { key: 'ALL' | DisplayStatus; label: string }[] = [
  { key: 'ALL', label: 'All' }, { key: 'ACTIVE', label: 'Active' }, { key: 'MISSING', label: 'Missing' },
  { key: 'STOLEN', label: 'Stolen' }, { key: 'TRANSFERRED', label: 'Transferred' },
];

export default function Livestock() {
  const { user } = useSession();
  const [filter, setFilter] = useState<'ALL' | DisplayStatus>('ALL');
  const { query } = useRoute();
  const [q, setQ] = useState(query.get('q') ?? '');
  const isFarmer = user!.role === 'FARMER';
  const isAdmin = user!.role === 'ADMIN';

  const rows = useDB((d) => {
    const list = isFarmer ? (() => { const h = herdFor(d, user!.id); return [...h.owned, ...h.transferredAway]; })() : d.animals;
    return list.map((a) => ({ a, s: displayStatus(d, a, user) }));
  });

  // Vet / verification users search by ID (no browsing of other farmers' herds)
  const searchOnly = !isFarmer && !isAdmin;
  const searched = searchAnimals(rows.map((r) => r.a), q);
  const ids = new Set(searched.map((a) => a.id));
  const visible = rows.filter((r) => ids.has(r.a.id)).filter((r) => filter === 'ALL' || r.s === filter || (filter === 'ACTIVE' && r.s === 'TRANSFER_PENDING'));
  const count = (k: 'ALL' | DisplayStatus) => (k === 'ALL' ? rows.length : rows.filter((r) => r.s === k || (k === 'ACTIVE' && r.s === 'TRANSFER_PENDING')).length);

  return (
    <div className="fade-up">
      <PageHeader title={isFarmer ? 'My livestock' : isAdmin ? 'All livestock' : 'Find a record'} subtitle={isFarmer ? `${count('ALL')} animals` : searchOnly ? 'Search by Muzzle ID or ear tag' : `${rows.length} registered animals`}
        action={isFarmer ? <Button size="md" icon="plus" onClick={() => navigate('/app/register')}>Add</Button> : undefined} />

      <label className="relative block">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Muzzle ID or ear tag"
          className="h-14 w-full rounded-2xl border-2 border-charcoal-900/10 bg-white pl-12 pr-4 text-base focus:border-forest-600 focus:outline-none" />
      </label>

      {!searchOnly && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.filter((f) => isFarmer || f.key !== 'TRANSFERRED').map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={cn('flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold',
              filter === f.key ? 'bg-forest-800 text-white' : 'bg-white text-charcoal-700 ring-1 ring-charcoal-900/10')}>
              {f.label}<span className={cn('rounded-full px-1.5 text-xs', filter === f.key ? 'bg-white/20' : 'bg-surface')}>{count(f.key)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {searchOnly && q.trim().length < 2 ? (
          <div className="sm:col-span-2"><EmptyState icon="lock" title="Search to view a record" body="For owner privacy, verification and veterinary users look up animals by Muzzle ID or ear tag, or by scanning." action={<Button size="md" icon="scan" onClick={() => navigate('/app/scan')}>Scan instead</Button>} /></div>
        ) : visible.length ? visible.map((r) => <AnimalCard key={r.a.id} animal={r.a} status={r.s} />) : (
          <div className="sm:col-span-2"><EmptyState icon="cow" title="No animals found" body={q ? 'Try a different Muzzle ID or ear tag.' : 'Nothing in this category.'} /></div>
        )}
      </div>
    </div>
  );
}
