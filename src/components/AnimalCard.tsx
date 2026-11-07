import type { Animal, DisplayStatus } from '../types/models';
import { AnimalPhoto } from './Brand';
import { StatusBadge, HEALTH_META } from './ui/primitives';
import { Icon } from './ui/Icon';
import { Link } from '../lib/router';
import { cn } from '../lib/utils';

export function AnimalCard({ animal, status }: { animal: Animal; status: DisplayStatus }) {
  const h = HEALTH_META[animal.health_status];
  return (
    <Link to={`/app/animal/${animal.id}`} className={cn('flex gap-3 rounded-2xl border border-charcoal-900/8 bg-white p-3 transition-colors hover:border-forest-600/40',
      status === 'STOLEN' && 'border-red-300 bg-red-50/40', status === 'MISSING' && 'border-amber-300 bg-amber-50/40')}>
      <AnimalPhoto src={animal.photo_url} alt={animal.breed} className={cn('h-24 w-24 shrink-0 rounded-xl', status === 'TRANSFERRED' && 'grayscale')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[15px] font-bold tracking-tight text-charcoal-950">{animal.muzzle_id}</p>
          <Icon name="chevronRight" size={18} className="mt-0.5 shrink-0 text-charcoal-400" />
        </div>
        <p className="truncate text-sm text-charcoal-700">{animal.name ? `${animal.name} · ` : ''}{animal.breed} · {animal.sex}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-charcoal-500"><Icon name="tag" size={13} /> {animal.ear_tag}
          {status !== 'TRANSFERRED' && <span className={cn('ml-2 font-semibold', h.cls)}>· {h.label}</span>}
        </p>
        <div className="mt-2"><StatusBadge status={status} /></div>
      </div>
    </Link>
  );
}
