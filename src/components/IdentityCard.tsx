import type { Animal } from '../types/models';
import { AnimalPhoto, LogoMark, MuzzlePattern } from './Brand';
import { fmtDate } from '../lib/utils';

/** The digital livestock identity card. */
export function IdentityCard({ animal, ownerName, verified = true }: { animal: Animal; ownerName: string; verified?: boolean }) {
  const pending = animal.muzzle_id.startsWith('PENDING');
  return (
    <div className="overflow-hidden rounded-3xl bg-forest-900 text-white shadow-xl ring-1 ring-forest-950">
      <div className="flex items-center justify-between bg-forest-950/60 px-5 py-3">
        <div className="flex items-center gap-2"><LogoMark size={26} /><span className="text-sm font-extrabold tracking-[0.18em]">MUZZLEID</span></div>
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-sand-400">Digital ID</span>
      </div>
      <div className="flex gap-4 p-5">
        <AnimalPhoto src={animal.photo_url} alt={animal.breed} className="h-32 w-28 shrink-0 rounded-2xl ring-2 ring-sand-400/60" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Muzzle ID</p>
          <p className="font-mono text-xl font-bold tracking-tight text-sand-200">{animal.muzzle_id}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="col-span-2"><dt className="text-white/50">Owner</dt><dd className="truncate font-semibold">{ownerName}</dd></div>
            <div><dt className="text-white/50">Breed</dt><dd className="font-semibold">{animal.breed}</dd></div>
            <div><dt className="text-white/50">Sex</dt><dd className="font-semibold">{animal.sex}</dd></div>
            <div><dt className="text-white/50">Ear tag</dt><dd className="font-semibold">{animal.ear_tag}</dd></div>
          </dl>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-white/10 px-5 py-4">
        <div className="text-xs">
          <p className="text-white/50">Farm</p>
          <p className="font-semibold">{animal.farm}, {animal.region}</p>
          <p className="mt-1.5 text-white/50">Registered</p>
          <p className="font-semibold">{fmtDate(animal.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <MuzzlePattern seed={animal.muzzle_id} className="h-12 w-16 opacity-90" />
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider ${pending ? 'bg-sand-400 text-charcoal-950' : verified ? 'bg-forest-500 text-white' : animal.status === 'STOLEN' ? 'bg-red-600 text-white' : 'bg-amber-500 text-charcoal-950'}`}>
            {pending ? 'PENDING SYNC' : verified ? 'VERIFIED · ACTIVE' : `VERIFIED · ${animal.status.replace('_', ' ')}`}
          </span>
        </div>
      </div>
    </div>
  );
}
