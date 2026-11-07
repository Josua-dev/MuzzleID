import { useEffect, useRef, useState } from 'react';
import { asset } from '../lib/assets';
import { Icon } from './ui/Icon';
import { cn } from '../lib/utils';

/** Step-by-step progress readout used for (simulated) biometric processing. */
export function ScanSequence({ steps, stepMs = 900, onDone, image }: { steps: string[]; stepMs?: number; onDone: () => void; image?: string }) {
  const [i, setI] = useState(0);
  const done = useRef(false);
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    if (i >= steps.length) {
      const t = setTimeout(() => { if (!done.current) { done.current = true; cb.current(); } }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), stepMs);
    return () => clearTimeout(t);
  }, [i, steps.length, stepMs]);
  return (
    <div className="rounded-3xl bg-charcoal-950 p-5 text-white">
      {image && (
        <div className="relative mx-auto mb-5 aspect-square w-48 overflow-hidden rounded-[45%] ring-4 ring-sand-400/70">
          <img src={asset(image)} alt="Captured muzzle" className="h-full w-full object-cover opacity-90" />
          <div className="scanline" />
        </div>
      )}
      <ul className="space-y-3">
        {steps.map((s, idx) => (
          <li key={s} className={cn('flex items-center gap-3 text-[15px] transition-opacity', idx > i && 'opacity-35')}>
            <span className={cn('grid h-7 w-7 place-items-center rounded-full', idx < i ? 'bg-forest-500' : idx === i ? 'bg-sand-500 text-charcoal-950' : 'bg-white/10')}>
              {idx < i ? <Icon name="check" size={16} /> : idx === i ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-charcoal-950" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/40" />}
            </span>
            <span className={idx === i ? 'font-semibold' : ''}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
