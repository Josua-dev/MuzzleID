import type { MovementRecord } from '../types/models';
import { Icon, type IconName } from './ui/Icon';
import { cn, fmtDate } from '../lib/utils';

const META: Record<MovementRecord['event'], { icon: IconName; label: string; cls: string }> = {
  REGISTERED: { icon: 'fingerprint', label: 'Registered', cls: 'bg-forest-700 text-white' },
  VACCINATED: { icon: 'syringe', label: 'Vaccinated', cls: 'bg-forest-100 text-forest-800' },
  TREATED: { icon: 'stethoscope', label: 'Treatment', cls: 'bg-amber-100 text-amber-800' },
  EXAMINED: { icon: 'stethoscope', label: 'Examination', cls: 'bg-forest-100 text-forest-800' },
  TRANSFER_REQUESTED: { icon: 'transfer', label: 'Transfer requested', cls: 'bg-blue-100 text-blue-800' },
  OWNERSHIP_TRANSFERRED: { icon: 'transfer', label: 'Ownership transferred', cls: 'bg-blue-600 text-white' },
  REPORTED_MISSING: { icon: 'alert', label: 'Reported missing', cls: 'bg-amber-500 text-white' },
  REPORTED_STOLEN: { icon: 'alert', label: 'Reported stolen', cls: 'bg-red-600 text-white' },
  RECOVERED: { icon: 'checkCircle', label: 'Recovered', cls: 'bg-forest-500 text-white' },
  VERIFIED: { icon: 'shieldCheck', label: 'Verified', cls: 'bg-sand-200 text-sand-700' },
};

export function Timeline({ items }: { items: MovementRecord[] }) {
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ol className="relative">
      {sorted.map((m, i) => {
        const meta = META[m.event];
        return (
          <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < sorted.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5 bg-charcoal-900/10" />}
            <span className={cn('z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full', meta.cls)}><Icon name={meta.icon} size={17} /></span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-bold">{meta.label} <span className="font-normal text-charcoal-500">· {fmtDate(m.date)}</span></p>
              <p className="text-sm text-charcoal-700">{m.description}</p>
              <p className="text-xs text-charcoal-500">{[m.location, m.actor_name].filter(Boolean).join(' · ')}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
