import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Input, KV, ProtoTag, StatusBadge, toast } from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { CameraCapture, type CaptureResult } from '../components/CameraCapture';
import { ScanSequence } from '../components/ScanSequence';
import { AnimalPhoto, MuzzlePattern } from '../components/Brand';
import { ContactOwnerSheet } from '../components/ContactOwnerSheet';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { dbStore, useDB } from '../services/store';
import { biometrics, type MatchResult } from '../services/biometric';
import { warmUpAi } from '../services/biometric/aiEmbedding';
import { addMuzzleAngle, markRecovered, recordScan, MAX_ANGLES } from '../services/actions';
import { currentOwnership, displayStatus, openReport, searchAnimals } from '../services/queries';
import { rules, visibilityFor } from '../lib/permissions';
import { cn, fmtDate, maskName } from '../lib/utils';
import { navigate } from '../lib/router';
import type { Animal } from '../types/models';

type Phase = 'start' | 'camera' | 'processing' | 'result';

const DEMO_TARGETS = [
  { id: 'a_238', hint: 'Registered · active' },
  { id: 'a_091', hint: 'Reported stolen' },
  { id: 'a_263', hint: 'Reported missing' },
];

export default function Scan() {
  const { user } = useSession();
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>('start');
  const [probeImage, setProbeImage] = useState<string>('/demo/muzzle.jpg');
  const [result, setResult] = useState<MatchResult | null>(null);
  const job = useRef<Promise<MatchResult> | null>(null);
  useEffect(() => { warmUpAi(); }, []);
  const recent = useDB((d) => d.animals.filter((a) => !a.is_demo && !a.muzzle_id.startsWith('PENDING')).slice(0, 2));
  const targets = useDB((d) => [...recent.map((a) => ({ id: a.id, hint: 'Just registered' })), ...DEMO_TARGETS].map((t) => ({ ...t, animal: d.animals.find((a) => a.id === t.id)! })).filter((t) => t.animal));

  const run = (image: string, hintId?: string) => {
    setProbeImage(image);
    const engine = biometrics();
    job.current = (async () => {
      const d = dbStore.get();
      const gallery = d.biometrics.filter((b) => b.embedding_reference).map((b) => ({ animalId: b.animal_id, reference: b.embedding_reference }));
      const probe = hintId ? { reference: '', quality: 0.9, modelVersion: engine.modelVersion } : await engine.extractTemplate(image);
      return engine.identify(probe, gallery, { demoHintAnimalId: hintId });
    })();
    setPhase('processing');
  };

  const onCaptured = (r: CaptureResult) => run(r.image);

  const onSequenceDone = async () => {
    const r = await job.current!;
    const a = r.animalId ? dbStore.get().animals.find((x) => x.id === r.animalId) : undefined;
    const alert = a && (a.status === 'STOLEN' || a.status === 'MISSING');
    recordScan(user!, { animal_id: a?.id, result: !r.matched ? 'NO_MATCH' : alert ? 'ALERT' : 'MATCH', confidence: r.confidence, simulated: r.simulated, mode: 'SERVER' }, online);
    setResult(r);
    setPhase('result');
  };

  const reset = () => { setPhase('start'); setResult(null); };

  if (!online && phase !== 'result') return <OfflineScan />;

  return (
    <div className="fade-up">
      {phase === 'start' && (
        <>
          <PageHeader title="Scan animal" subtitle="Identify an animal from its muzzle" />
          <button onClick={() => setPhase('camera')} className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-forest-900 px-6 py-10 text-white">
            <div className="relative grid h-36 w-44 place-items-center rounded-[50%] border-[3px] border-dashed border-sand-400/80">
              <Icon name="scan" size={56} className="text-sand-400" strokeWidth={1.8} />
              <div className="scanline" />
            </div>
            <span className="mt-6 text-2xl font-extrabold tracking-wide">SCAN MUZZLE</span>
            <span className="mt-1 text-sm text-white/70">Camera or photo upload</span>
          </button>
          <button onClick={() => navigate('/app/sms')} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm ring-1 ring-charcoal-900/10"><span><b>No smartphone?</b> Check an animal by SMS, WhatsApp or USSD</span><Icon name="arrowRight" size={18} /></button>

          <div className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-charcoal-900/8">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-bold">Demo scan targets</p>
              <ProtoTag>Prototype</ProtoTag>
            </div>
            <p className="mb-3 text-xs text-charcoal-500">For presentations without a live animal: choose which registered animal is “in front of the camera”. Matching and confidence are simulated.</p>
            <div className="grid gap-2">
              {targets.map((t) => (
                <button key={t.id} onClick={() => run(dbStore.get().biometrics.find((b) => b.animal_id === t.id)?.reference_image || '/demo/muzzle.jpg', t.id)}
                  className="flex items-center gap-3 rounded-2xl border-2 border-charcoal-900/8 p-2.5 text-left hover:border-forest-600">
                  <AnimalPhoto src={t.animal.photo_url} alt="" className="h-14 w-14 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold">{t.animal.muzzle_id}</p>
                    <p className="truncate text-xs text-charcoal-500">{t.animal.name ? `${t.animal.name} · ` : ''}{t.animal.breed} · {t.hint}</p>
                  </div>
                  <Icon name="scan" size={20} className={cn(t.animal.status === 'STOLEN' ? 'text-red-600' : t.animal.status === 'MISSING' ? 'text-amber-600' : 'text-forest-700')} />
                </button>
              ))}
              <button onClick={() => run('/demo/muzzle.jpg', 'unregistered')} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-charcoal-900/12 p-2.5 text-left hover:border-forest-600">
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface"><Icon name="search" className="text-charcoal-500" /></div>
                <div className="flex-1"><p className="text-sm font-bold">Unregistered animal</p><p className="text-xs text-charcoal-500">Shows the “no match” result</p></div>
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'camera' && (
        <>
          <PageHeader title="Scan muzzle" subtitle="Position muzzle inside frame" action={<button onClick={reset} className="text-sm font-semibold text-forest-700">Cancel</button>} />
          <CameraCapture onUse={onCaptured} cta="Scan" />
        </>
      )}

      {phase === 'processing' && (
        <>
          <PageHeader title="Scanning…" />
          <ScanSequence image={probeImage} steps={['Scanning...', 'Pattern detected', 'Searching registered animals...']} stepMs={850} onDone={onSequenceDone} />
          <p className="mt-3 text-center"><ProtoTag>Prototype — feature matching, not yet field-validated</ProtoTag></p>
        </>
      )}

      {phase === 'result' && result && <ScanResult result={result} probeImage={probeImage} onAgain={reset} />}
    </div>
  );
}

function ScanResult({ result, probeImage, onAgain }: { result: MatchResult; probeImage: string; onAgain: () => void }) {
  const { user } = useSession();
  const online = useOnline();
  const [contact, setContact] = useState(false);
  const [angleSaved, setAngleSaved] = useState(false);
  const angles = useDB((d) => d.biometrics.filter((b) => b.animal_id === result.animalId).length);
  const view = useDB((d) => {
    const a = result.animalId ? d.animals.find((x) => x.id === result.animalId) : undefined;
    if (!a) return null;
    const vis = visibilityFor(user!, a, d);
    return { a, vis, r: rules(vis), own: currentOwnership(d, a.id), report: openReport(d, a.id), status: displayStatus(d, a, user) };
  });

  if (!result.matched || !view) {
    return (
      <div className="fade-up space-y-4">
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-charcoal-900/8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface"><Icon name="search" size={30} className="text-charcoal-500" /></div>
          <p className="mt-4 text-2xl font-extrabold">No match found</p>
          <p className="mt-1 text-charcoal-500">This muzzle does not match any registered animal ({result.candidatesSearched} records searched).</p>
          <p className="mt-3"><ProtoTag>Simulated matching</ProtoTag></p>
        </div>
        {user!.role === 'FARMER' && <Button full size="xl" icon="plus" onClick={() => navigate('/app/register')}>Register this animal</Button>}
        <Button full variant="outline" icon="refresh" onClick={onAgain}>Scan again</Button>
      </div>
    );
  }

  const { a, r, own, report, status } = view;
  const ownerName = own ? (r.ownerFullName ? own.owner_name : maskName(own.owner_name)) : '—';
  const isOwner = a.owner_id === user!.id;

  if (a.status === 'STOLEN' || a.status === 'MISSING') {
    return (
      <div className="fade-up space-y-4">
        <div className="overflow-hidden rounded-3xl bg-red-600 text-white shadow-xl ring-4 ring-red-300">
          <div className="flex items-center gap-3 bg-red-700 px-5 py-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-red-600"><Icon name="alert" size={28} strokeWidth={2.5} /></span>
            <div>
              <p className="text-3xl font-black tracking-wider">ALERT</p>
              <p className="text-sm font-extrabold uppercase tracking-wide">Reported stolen/missing animal</p>
              <span className="mt-1 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black tracking-wider text-red-700">STATUS: {a.status}</span>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/70">MuzzleID</p>
            <p className="font-mono text-3xl font-bold">{a.muzzle_id}</p>
            <p className="mt-3 text-[15px] leading-snug">The scanned animal matches a livestock record currently reported as stolen or missing.</p>
            <div className="mt-4 flex gap-3 rounded-2xl bg-white p-3 text-charcoal-900">
              <AnimalPhoto src={a.photo_url} alt={a.breed} className="h-24 w-24 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Report date</p>
                <p className="font-bold">{fmtDate(report?.reported_at)}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-red-700">Owner</p>
                <p className="font-bold">{ownerName}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-red-700">Region</p>
                <p className="font-bold">{a.region}</p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-red-700/60 p-3 text-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Animal description</p>
              <p>{a.breed} · {a.sex} · {a.colour} · ear tag {a.ear_tag}</p>
              {report?.description && <p className="mt-1 text-white/85">{report.description}</p>}
            </div>
            <p className="mt-3 text-xs text-white/75">Simulated match confidence {result.confidence}% · prototype result. Treat as an alert for follow-up, not as proof.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" icon="eye" onClick={() => navigate(`/app/animal/${a.id}`)}>View record</Button>
          {isOwner
            ? <Button icon="checkCircle" onClick={() => { markRecovered(user!, a.id, 'Recovered — identified by muzzle scan', online); toast('Marked as recovered'); }}>Mark recovered</Button>
            : <Button variant="danger" icon="message" onClick={() => setContact(true)}>Contact owner</Button>}
        </div>
        <Button full variant="ghost" icon="refresh" onClick={onAgain}>Scan another animal</Button>
        {!isOwner && <ContactOwnerSheet open={contact} onClose={() => setContact(false)} animal={a} user={user!} />}
      </div>
    );
  }

  return (
    <div className="fade-up space-y-4">
      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-charcoal-900/8">
        <div className={cn('flex items-center justify-between px-5 py-4 text-white', status === 'TRANSFER_PENDING' ? 'bg-blue-600' : 'bg-forest-700')}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20"><Icon name="checkCircle" size={26} /></span>
            <div>
              <p className="text-xl font-black tracking-wide">MATCH FOUND</p>
              <p className="text-xs text-white/80">Registered animal identified</p>
            </div>
          </div>
          <MuzzlePattern seed={a.muzzle_id} className="h-10 w-14" />
        </div>
        <div className="p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-charcoal-500">MuzzleID</p>
              <p className="font-mono text-3xl font-bold tracking-tight">{a.muzzle_id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-charcoal-500">Confidence</p>
              <p className="text-2xl font-extrabold text-forest-700">{result.confidence}%</p>
            </div>
          </div>
          {result.simulated && <p className="mt-1 text-right"><ProtoTag>Simulated prototype data</ProtoTag></p>}
          <div className="mt-4 flex gap-4">
            <AnimalPhoto src={a.photo_url} alt={a.breed} className="h-32 w-28 shrink-0 rounded-2xl" />
            <div className="flex-1">
              <KV k="Breed" v={a.breed} />
              <KV k="Sex" v={a.sex} />
              <KV k="Owner" v={ownerName} />
              {result.aiSimilarity !== undefined && <KV k="AI similarity" v={result.aiSimilarity.toFixed(2)} />}
              <KV k={r.farm ? 'Farm / region' : 'Region'} v={r.farm ? `${a.farm}, ${a.region}` : a.region} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface p-3">
            <span className="text-sm font-semibold text-charcoal-700">Registration status</span>
            <StatusBadge status={status} size="lg" />
          </div>
          {user!.role === 'VERIFIER' && (
            <div className="mt-3 flex gap-2 rounded-2xl bg-forest-50 p-3 text-sm text-forest-900">
              <Icon name="shieldCheck" size={18} className="mt-0.5 shrink-0" />
              <p>Ownership on record: <b>{ownerName}</b> since {fmtDate(own?.start_date)}. No open theft or missing report.</p>
            </div>
          )}
        </div>
      </div>
      <Button full size="xl" icon="eye" onClick={() => navigate(`/app/animal/${a.id}`)}>View record</Button>
      {isOwner && !result.simulated && !angleSaved && angles < MAX_ANGLES && (
        <Button full variant="outline" icon="plus" onClick={async () => {
          const t = await biometrics().extractTemplate(probeImage);
          if (addMuzzleAngle(user!, a.id, probeImage, t, online)) { setAngleSaved(true); toast('Angle saved — future scans from this side will match more easily'); }
        }}>Save this angle to improve matching ({angles}/{MAX_ANGLES})</Button>
      )}
      <Button full variant="outline" icon="refresh" onClick={onAgain}>Scan again</Button>
    </div>
  );
}

/** Offline: no server-side biometric matching. Offer lookup of records stored on this device. */
function OfflineScan() {
  const { user } = useSession();
  const [q, setQ] = useState('');
  const animals = useDB((d) => d.animals);
  const results = useMemo(() => (q.trim().length >= 2 ? searchAnimals(animals, q).slice(0, 6) : []), [q, animals]);
  const [picked, setPicked] = useState<Animal | null>(null);

  return (
    <div className="fade-up">
      <PageHeader title="Scan animal" subtitle="Offline mode" />
      <div className="rounded-3xl bg-charcoal-900 p-5 text-white">
        <div className="flex items-center gap-3"><Icon name="cloudOff" size={28} className="text-sand-400" /><p className="text-lg font-bold">Biometric matching needs a connection</p></div>
        <p className="mt-2 text-sm text-white/75">Muzzle matching runs on the MuzzleID server and is not available offline. You can still look up records stored on this device by MuzzleID or ear tag.</p>
      </div>
      <Input className="mt-4" label="Look up a local record" placeholder="Search MuzzleID or ear tag" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} />
      <div className="mt-3 space-y-2">
        {results.map((a) => (
          <button key={a.id} onClick={() => { setPicked(a); recordScan(user!, { animal_id: a.id, result: 'LOCAL_LOOKUP', simulated: false, mode: 'LOCAL' }, false); }} className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left ring-1 ring-charcoal-900/8">
            <AnimalPhoto src={a.photo_url} alt="" className="h-12 w-12 rounded-xl" />
            <div className="flex-1"><p className="font-mono text-sm font-bold">{a.muzzle_id}</p><p className="text-xs text-charcoal-500">{a.breed} · tag {a.ear_tag}</p></div>
            <StatusBadge status={a.status} />
          </button>
        ))}
        {q.trim().length >= 2 && !results.length && <p className="text-sm text-charcoal-500">No local record matches “{q}”.</p>}
      </div>
      {picked && (
        <div className="mt-4 rounded-2xl bg-sand-50 p-4 ring-2 ring-sand-400/60">
          <p className="text-xs font-extrabold uppercase tracking-widest text-sand-700">Local record — not biometrically verified</p>
          {(picked.status === 'STOLEN' || picked.status === 'MISSING') && <p className="mt-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white">This record is reported {picked.status.toLowerCase()} (as of last sync).</p>}
          <p className="mt-2 text-sm text-charcoal-700">Confirm the identity with a muzzle scan when you are back online.</p>
          <Button full className="mt-3" icon="eye" onClick={() => navigate(`/app/animal/${picked.id}`)}>Open record</Button>
        </div>
      )}
    </div>
  );
}
