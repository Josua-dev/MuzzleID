import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { asset } from '../lib/assets';
import { Button, ProtoTag } from './ui/primitives';
import { Icon } from './ui/Icon';
import { biometrics, type QualityReport } from '../services/biometric';
import { cn, downscaleImage, readFileAsDataUrl } from '../lib/utils';

type Phase = 'idle' | 'starting' | 'live' | 'review';

export interface CaptureResult { image: string; quality: QualityReport }

/**
 * Muzzle capture with an oval guide, live image-quality checks, capture / retake / use photo,
 * and photo upload as a fallback when the camera is unavailable.
 */
export function CameraCapture({ onUse, cta = 'Use photo', allowSample = true, requirePass = false, sampleSrc = '/demo/muzzle.jpg' }: { onUse: (r: CaptureResult) => void; cta?: string; allowSample?: boolean; requirePass?: boolean; sampleSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [live, setLive] = useState<QualityReport | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser. Upload a photo instead.');
      return;
    }
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      setPhase('live');
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => undefined); }
      });
    } catch {
      setPhase('idle');
      setError('Camera permission was not granted. You can upload a photo instead.');
    }
  };

  const grab = (size: number) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const s = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.getContext('2d')?.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.82);
  };

  // Live quality readout while the camera is open
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(async () => {
      const f = grab(128);
      if (f) setLive(await biometrics().assessQuality(f).catch(() => null));
    }, 900);
    return () => clearInterval(t);
  }, [phase]);

  const review = async (img: string) => {
    setBusy(true);
    setImage(img);
    const eng = biometrics();
    setQuality(await (eng.gate ? eng.gate(img) : eng.assessQuality(img)).catch(() => null));
    setPhase('review');
    setBusy(false);
  };

  const capture = async () => {
    const f = grab(560);
    if (!f) return;
    stop();
    await review(f);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    stop();
    try { await review(await downscaleImage(await readFileAsDataUrl(f))); }
    catch { setError('Could not read that image. Try another photo.'); }
  };

  const useSample = async () => { stop(); await review(await downscaleImage(asset(sampleSrc))); };

  const retake = () => { setImage(null); setQuality(null); setPhase('idle'); };

  const checks = (phase === 'review' ? quality : live)?.checks;

  return (
    <div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl bg-charcoal-950">
        {phase === 'live' || phase === 'starting' ? (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        ) : image ? (
          <img src={image} alt="Captured muzzle" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
            <Icon name="camera" size={40} className="text-sand-400" />
            <p className="text-lg font-semibold text-white">Position the animal's muzzle inside the frame.</p>
            <p className="text-sm">Fill the oval with the nose. Use daylight, avoid shadows, hold steady.</p>
          </div>
        )}
        {/* Oval guide */}
        <div className="pointer-events-none absolute inset-0">
          <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="h-full w-full">
            <defs><mask id="ovalmask"><rect width="100" height="125" fill="white" /><ellipse cx="50" cy="60" rx="38" ry="33" fill="black" /></mask></defs>
            <rect width="100" height="125" fill="rgba(11,13,12,.45)" mask="url(#ovalmask)" />
            <ellipse cx="50" cy="60" rx="38" ry="33" fill="none" stroke={phase === 'review' && quality?.passed ? '#2f7d4f' : '#d9ae78'} strokeWidth="0.9" strokeDasharray={phase === 'live' ? '3 2' : undefined} />
          </svg>
          {phase === 'live' && <div className="scanline" />}
          {phase === 'live' && <p className="absolute inset-x-0 top-4 text-center text-sm font-semibold text-white drop-shadow">Position muzzle inside frame</p>}
        </div>
      </div>

      {checks && (
        <div className="mx-auto mt-3 grid max-w-sm grid-cols-3 gap-2">
          {checks.map((c) => (
            <div key={c.key} className={cn('rounded-xl px-2 py-2 text-center ring-1', c.status === 'good' ? 'bg-forest-50 text-forest-800 ring-forest-600/20' : c.status === 'fair' ? 'bg-amber-50 text-amber-800 ring-amber-500/30' : 'bg-red-50 text-red-700 ring-red-500/30')}>
              <div className="flex items-center justify-center gap-1 text-xs font-bold"><Icon name={c.status === 'good' ? 'check' : 'alert'} size={13} />{c.label}</div>
              <div className="mt-0.5 text-[11px] leading-tight">{c.message}</div>
            </div>
          ))}
        </div>
      )}
      {checks && checks.some((c) => c.simulated) && <p className="mt-1.5 text-center text-[11px] text-charcoal-500">Muzzle visibility is a <ProtoTag className="align-middle">prototype heuristic</ProtoTag></p>}

      {error && <p className="mx-auto mt-3 max-w-sm rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{error}</p>}

      <div className="mx-auto mt-4 grid max-w-sm gap-2">
        {phase === 'idle' && (<>
          <Button size="xl" icon="camera" onClick={start}>Open camera</Button>
          <Button variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>Upload photo</Button>
          {allowSample && <Button variant="ghost" size="md" icon="image" onClick={useSample}>Use sample muzzle photo (demo)</Button>}
        </>)}
        {phase === 'starting' && <Button size="xl" disabled>Starting camera…</Button>}
        {phase === 'live' && (<>
          <Button size="xl" icon="focus" onClick={capture}>Capture</Button>
          <Button variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>Upload instead</Button>
        </>)}
        {phase === 'review' && image && (<>
          {quality && !quality.passed && <p className="text-center text-sm font-medium text-amber-800">{(quality.checks.find((c) => c.status === 'poor')?.message ?? 'Photo quality is low') + (requirePass ? '. Please retake.' : '. A retake is recommended.')}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" icon="refresh" onClick={retake}>Retake</Button>
            <Button icon="check" disabled={busy || (requirePass && !!quality && !quality.passed)} onClick={() => quality && onUse({ image, quality })}>{cta}</Button>
          </div>
        </>)}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  );
}
