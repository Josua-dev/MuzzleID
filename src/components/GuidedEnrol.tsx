import { useState } from 'react';
import { CameraCapture, type CaptureResult } from './CameraCapture';
import { Button } from './ui/primitives';
import { Icon } from './ui/Icon';
import { biometrics } from '../services/biometric';
import { cn } from '../lib/utils';

const ANGLES = [
  { key: 'front', title: 'Front view', hint: 'Hold the camera straight in front of the nose, about 30 cm away. Fill the oval with the muzzle.', sample: '/demo/muzzle.jpg', required: true },
  { key: 'left', title: 'Left angle', hint: 'Move about 25° to the animal’s LEFT (your right) and keep the nose in the oval.', sample: '/demo/muzzle-hero.jpg', required: false },
  { key: 'right', title: 'Right angle', hint: 'Now move about 25° to the animal’s RIGHT (your left) and keep the nose in the oval.', sample: '/demo/muzzle.jpg', required: false },
] as const;

/** Minimum consistent matches for a side photo to be accepted as the same muzzle as the front photo. */
const SAME_MUZZLE = 12;

/**
 * Guided enrolment: front, left, right. Every photo must pass the quality gate. Side angles are checked
 * against the front photo, so a wrong animal or a junk photo is caught before it pollutes the record.
 */
export function GuidedEnrol({ onDone, cta }: { onDone: (captures: CaptureResult[]) => void; cta: string }) {
  const [shots, setShots] = useState<CaptureResult[]>([]);
  const [pending, setPending] = useState<CaptureResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [mismatch, setMismatch] = useState<number | null>(null);
  const idx = shots.length;
  const cur = ANGLES[Math.min(idx, ANGLES.length - 1)];

  const accept = (r: CaptureResult) => {
    const next = [...shots, r];
    setPending(null); setMismatch(null);
    if (next.length >= ANGLES.length) onDone(next); else setShots(next);
  };

  const onUse = async (r: CaptureResult) => {
    if (idx === 0) return accept(r);
    const eng = biometrics();
    if (!eng.compareImages) return accept(r);
    setChecking(true);
    const n = await eng.compareImages(r.image, shots[0].image).catch(() => SAME_MUZZLE);
    setChecking(false);
    if (n >= SAME_MUZZLE) accept(r); else { setPending(r); setMismatch(n); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-2">
        {ANGLES.map((a, i) => (
          <div key={a.key} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1', i < idx ? 'bg-forest-50 text-forest-800 ring-forest-600/30' : i === idx ? 'bg-charcoal-900 text-white ring-charcoal-900' : 'bg-white text-charcoal-500 ring-charcoal-900/10')}>
            {i < idx ? <Icon name="check" size={13} /> : <span>{i + 1}</span>}{a.title.split(' ')[0]}
          </div>
        ))}
      </div>
      <div className="mb-3 rounded-2xl bg-sand-50 p-4 ring-1 ring-sand-400/40">
        <p className="font-bold">{idx + 1}/3 · {cur.title}{cur.required ? '' : ' (recommended)'}</p>
        <p className="mt-1 text-sm text-charcoal-700">{cur.hint}</p>
        {idx === 0 && <p className="mt-1 text-xs text-charcoal-500">Photos from 3 angles let OwaMuzzle recognise this animal later even when it is photographed from the side.</p>}
      </div>

      {mismatch !== null && pending && (
        <div className="mb-3 rounded-2xl bg-amber-50 p-4 text-sm ring-2 ring-amber-400">
          <p className="font-bold text-amber-900">This doesn’t look like the same muzzle as the front photo.</p>
          <p className="mt-1 text-amber-900/80">Only {mismatch} matching points were found. Check it is the same animal, hold steady, and keep the nose in the oval. If you are sure, you can keep it.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" icon="refresh" onClick={() => { setPending(null); setMismatch(null); }}>Retake</Button>
            <Button variant="ghost" size="md" onClick={() => accept(pending)}>Keep anyway</Button>
          </div>
        </div>
      )}

      {!pending && (
        <>
          <CameraCapture key={cur.key} requirePass cta={checking ? 'Checking…' : cta === 'Use photo' ? 'Use this angle' : cta} onUse={onUse} sampleSrc={cur.sample} />
          <div className="mx-auto mt-2 grid max-w-sm gap-2">
            {idx > 0 && <Button variant="ghost" size="md" onClick={() => onDone(shots)}>Skip remaining angles</Button>}
          </div>
        </>
      )}
    </div>
  );
}
