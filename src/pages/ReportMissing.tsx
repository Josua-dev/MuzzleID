import { useState } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, EmptyState, Input, TextArea, toast } from '../components/ui/primitives';
import { AnimalPhoto } from '../components/Brand';
import { Icon } from '../components/ui/Icon';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useDB } from '../services/store';
import { reportTheft } from '../services/actions';
import { navigate, useRoute } from '../lib/router';
import { cn } from '../lib/utils';

export default function ReportMissing() {
  const { user } = useSession();
  const online = useOnline();
  const { query } = useRoute();
  const [animalId, setAnimalId] = useState(query.get('animal') ?? '');
  const mine = useDB((d) => d.animals.filter((a) => a.owner_id === user!.id && (a.status === 'ACTIVE' || a.status === 'TRANSFER_PENDING')));
  const a = mine.find((x) => x.id === animalId);
  const [type, setType] = useState<'MISSING' | 'STOLEN'>('MISSING');
  const [f, setF] = useState({ last_seen_date: new Date().toISOString().slice(0, 10), last_seen_location: '', description: '' });

  const submit = () => {
    if (!a) return;
    reportTheft(user!, a.id, { type, ...f, last_seen_location: f.last_seen_location || `${a.farm}, ${a.region}` }, online);
    toast(online ? `${a.muzzle_id} reported ${type.toLowerCase()}` : 'Report saved on device · pending sync', online ? 'ok' : 'warn');
    navigate(`/app/animal/${a.id}`, true);
  };

  return (
    <div className="fade-up">
      <PageHeader title="Report missing or stolen" subtitle="Flag an animal so scans raise an alert" backTo="/app" />
      {!a ? (
        mine.length ? (
          <div className="space-y-2">
            <p className="mb-2 text-sm font-semibold text-charcoal-700">Select the animal</p>
            {mine.map((x) => (
              <button key={x.id} onClick={() => setAnimalId(x.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-charcoal-900/8 hover:ring-forest-600">
                <AnimalPhoto src={x.photo_url} alt="" className="h-14 w-14 rounded-xl" />
                <div className="flex-1"><p className="font-mono font-bold">{x.muzzle_id}</p><p className="text-sm text-charcoal-500">{x.name ? `${x.name} · ` : ''}{x.breed} · tag {x.ear_tag}</p></div>
                <Icon name="chevronRight" className="text-charcoal-400" />
              </button>
            ))}
          </div>
        ) : <EmptyState icon="cow" title="No active animals to report" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/8">
            <AnimalPhoto src={a.photo_url} alt="" className="h-14 w-14 rounded-xl" />
            <div className="flex-1"><p className="font-mono font-bold">{a.muzzle_id}</p><p className="text-sm text-charcoal-500">{a.breed} · {a.sex} · {a.colour}</p></div>
            {!query.get('animal') && <button onClick={() => setAnimalId('')} className="text-sm font-semibold text-forest-700">Change</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['MISSING', 'STOLEN'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={cn('flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border-2 text-base font-extrabold tracking-wide',
                type === t ? (t === 'STOLEN' ? 'border-red-600 bg-red-600 text-white' : 'border-amber-500 bg-amber-500 text-white') : 'border-charcoal-900/12 bg-white')}>
                <Icon name="alert" size={20} /> {t}
              </button>
            ))}
          </div>
          <Input label="Last seen (date)" type="date" value={f.last_seen_date} onChange={(e) => setF({ ...f, last_seen_date: e.target.value })} />
          <Input label="Last seen (place)" placeholder={`${a.farm}, ${a.region}`} value={f.last_seen_location} onChange={(e) => setF({ ...f, last_seen_location: e.target.value })} />
          <TextArea label="Description" hint="Optional" placeholder="Markings, circumstances, fence damage…" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="rounded-2xl bg-surface p-3 text-xs text-charcoal-500">
            Once reported, any OwaMuzzle scan of this animal shows a red alert to the person scanning. This report is recorded in OwaMuzzle only. Please also report livestock theft to the police as you normally would.
          </div>
          <Button full size="xl" variant={type === 'STOLEN' ? 'danger' : 'primary'} icon="flag" onClick={submit}>Report {type.toLowerCase()}</Button>
        </div>
      )}
    </div>
  );
}
