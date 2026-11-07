import { cn, seeded } from '../lib/utils';
import { asset } from '../lib/assets';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const r = seeded('muzzleid-logo');
  const dots = Array.from({ length: 16 }, () => [8 + r() * 24, 11 + r() * 18, 1.3 + r() * 1.6] as const)
    .filter(([x, y]) => ((x - 20) / 13) ** 2 + ((y - 20) / 10) ** 2 < 1);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#143d29" />
      <ellipse cx="20" cy="20" rx="14.5" ry="11.5" fill="none" stroke="#d9ae78" strokeWidth="2" />
      {dots.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={s} fill="#f7eee0" />)}
    </svg>
  );
}

export function Logo({ light, className, tagline }: { light?: boolean; className?: string; tagline?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <div className="leading-none">
        <div className={cn('text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-charcoal-950')}>
          Muzzle<span className={light ? 'text-sand-400' : 'text-forest-700'}>ID</span>
        </div>
        {tagline && <div className={cn('mt-1 text-[11px] font-medium', light ? 'text-white/70' : 'text-charcoal-500')}>Every Animal Has an Identity.</div>}
      </div>
    </div>
  );
}

/**
 * Seeded visualisation of a muzzle "bead & ridge" pattern for a given MuzzleID.
 * Illustrative only — it is not the stored biometric template.
 */
export function MuzzlePattern({ seed, className, dark = true }: { seed: string; className?: string; dark?: boolean }) {
  const r = seeded(seed);
  const cells: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];
  for (let i = 0; i < 150; i++) {
    const x = 6 + r() * 88, y = 8 + r() * 64;
    if (((x - 50) / 44) ** 2 + ((y - 40) / 32) ** 2 > 1) continue;
    if (((x - 26) / 9) ** 2 + ((y - 46) / 12) ** 2 < 1 || ((x - 74) / 9) ** 2 + ((y - 46) / 12) ** 2 < 1) continue;
    cells.push({ x, y, rx: 1.6 + r() * 2.6, ry: 1.4 + r() * 2.2, rot: r() * 180 });
  }
  return (
    <svg viewBox="0 0 100 80" className={className} aria-label="Muzzle pattern visualisation">
      <ellipse cx="50" cy="40" rx="46" ry="34" fill={dark ? '#2a2e2b' : '#efdcc0'} />
      <ellipse cx="26" cy="46" rx="9" ry="12" fill={dark ? '#0b0d0c' : '#8f6430'} />
      <ellipse cx="74" cy="46" rx="9" ry="12" fill={dark ? '#0b0d0c' : '#8f6430'} />
      <path d="M50 10 L50 74" stroke={dark ? '#1c1f1d' : '#c8955a'} strokeWidth="1" />
      {cells.map((c, i) => (
        <ellipse key={i} cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} transform={`rotate(${c.rot} ${c.x} ${c.y})`}
          fill={dark ? '#6b716d' : '#f7eee0'} stroke={dark ? '#1c1f1d' : '#a9783f'} strokeWidth="0.5" opacity={0.9} />
      ))}
    </svg>
  );
}

export function AnimalPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={asset(src)} alt={alt} loading="lazy" className={cn('bg-sand-100 object-cover', className)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = asset('/demo/muzzle.jpg'); }} />;
}
