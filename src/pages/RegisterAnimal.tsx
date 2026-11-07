import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Choice, Input, ProtoTag, Select, toast } from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { warmUpAi } from '../services/biometric/aiEmbedding';
import { GuidedEnrol } from '../components/GuidedEnrol';
import type { CaptureResult } from '../components/CameraCapture';
import { ScanSequence } from '../components/ScanSequence';
import { IdentityCard } from '../components/IdentityCard';
import { AnimalPhoto } from '../components/Brand';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { dbStore, useDB } from '../services/store';
import { biometrics, type BiometricTemplate, type MatchResult } from '../services/biometric';
import { registerAnimal, type RegisterInput } from '../services/actions';
import { BREEDS, COLOURS, REGIONS, cn, downscaleImage, readFileAsDataUrl } from '../lib/utils';
import { navigate } from '../lib/router';
import type { Animal, Sex } from '../types/models';

const STEPS = ['Details', 'Muzzle', 'Identity', 'Record'];
const YEARS = Array.from({ length: 18 }, (_, i) => String(new Date().getFullYear() - i));

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-5 grid grid-cols-4 gap-1.5">
      {STEPS.map((s, i) => (
        <li key={s}>
          <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-forest-700' : 'bg-charcoal-900/10')} />
          <p className={cn('mt-1.5 text-[11px] font-bold uppercase tracking-wider', i === step ? 'text-forest-800' : 'text-charcoal-400')}>{i + 1}. {s}</p>
        </li>
      ))}
    </ol>
  );
}

export default function RegisterAnimal() {
  const { user, profile } = useSession();
  const online = useOnline();
  const [step, setStep] = useState(0);
  useEffect(() => { warmUpAi(); }, []);
  const [info, setInfo] = useState<RegisterInput>({
    name: '', ear_tag: '', breed: 'Brahman', sex: 'Female', birth_date: String(new Date().getFullYear() - 3), colour: 'Grey-white',
    farm: profile?.farm_name ?? '', region: profile?.region ?? 'Omaheke',
  });
  const [photo, setPhoto] = useState<string | undefined>();
  const [captures, setCaptures] = useState<CaptureResult[]>([]);
  const capture = captures[0] ?? null;
  const [created, setCreated] = useState<Animal | null>(null);
  const [dup, setDup] = useState<{ match: MatchResult; template: BiometricTemplate; templates: BiometricTemplate[] } | null>(null);
  const [seqDone, setSeqDone] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const work = useRef<Promise<{ template: BiometricTemplate; templates: BiometricTemplate[]; match: MatchResult }> | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const tagTaken = useDB((d) => info.ear_tag.trim().length > 2 && d.animals.some((a) => a.ear_tag.toUpperCase() === info.ear_tag.trim().toUpperCase()));

  const set = <K extends keyof RegisterInput>(k: K, v: RegisterInput[K]) => setInfo((s) => ({ ...s, [k]: v }));

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(await downscaleImage(await readFileAsDataUrl(f)));
  };

  const onMuzzle = (rs: CaptureResult[]) => {
    setCaptures(rs);
    const extras = (templates?: BiometricTemplate[]) => rs.slice(1).map((c, i) => ({ image: c.image, template: templates?.[i + 1] }));
    if (!online) {
      // Offline: store every angle on device, defer server-side biometric enrolment
      const a = registerAnimal(user!, info, { muzzleImage: rs[0].image, photo, online: false, extras: extras() });
      setCreated(a);
      setOfflineSaved(true);
      setStep(2);
      return;
    }
    // Online: enrol every angle and check each against existing records, in parallel with the visual sequence
    const engine = biometrics();
    work.current = (async () => {
      const templates: BiometricTemplate[] = [];
      for (const r of rs) templates.push(await engine.extractTemplate(r.image));
      const d = dbStore.get();
      const gallery = d.biometrics.filter((b) => b.embedding_reference).map((b) => ({ animalId: b.animal_id, reference: b.embedding_reference }));
      let match: MatchResult | null = null;
      for (const t of templates) {
        const m = await engine.identify(t, gallery);
        if (m.matched && (!match || !match.matched || (m.confidence ?? 0) > (match.confidence ?? 0))) match = m;
        else if (!match) match = m;
      }
      return { template: templates[0], templates, match: match! };
    })();
    setSeqDone(false);
    setStep(2);
  };

  const finishSequence = useCallback(async () => {
    const res = await work.current!;
    if (res.match.matched) { setDup(res); setSeqDone(true); return; }
    const a = registerAnimal(user!, info, { muzzleImage: capture!.image, photo, template: res.template, online: true, extras: captures.slice(1).map((c, i) => ({ image: c.image, template: res.templates[i + 1] })) });
    setCreated(a);
    setSeqDone(true);
  }, [capture, captures, info, photo, user]);

  const registerAnyway = async () => {
    if (!dup) return;
    const a = registerAnimal(user!, info, { muzzleImage: capture!.image, photo, template: dup.template, online: true, extras: captures.slice(1).map((c, i) => ({ image: c.image, template: dup.templates[i + 1] })) });
    setDup(null);
    setCreated(a);
    toast('Registered, flagged for duplicate review', 'warn');
  };

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const dupAnimal = useDB((d) => (dup?.match.animalId ? d.animals.find((a) => a.id === dup.match.animalId) : undefined));
  const valid = info.ear_tag.trim().length >= 3 && info.farm.trim() && !tagTaken;

  return (
    <div className="fade-up">
      <PageHeader title="Register cattle" subtitle="Create a permanent digital identity" backTo="/app" />
      <Stepper step={step} />

      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/8">
            {photo ? <AnimalPhoto src={photo} alt="Animal" className="h-20 w-20 rounded-xl" /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-sand-100 text-sand-700"><Icon name="image" size={28} /></div>}
            <div className="flex-1">
              <p className="font-bold">Animal photo</p>
              <p className="text-xs text-charcoal-500">Optional. Shown on the identity card.</p>
              <button type="button" onClick={() => photoRef.current?.click()} className="mt-2 text-sm font-bold text-forest-700">{photo ? 'Change photo' : 'Add photo'}</button>
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          </div>
          <Input label="Ear tag number" value={info.ear_tag} onChange={(e) => set('ear_tag', e.target.value)} placeholder="e.g. NA-0847-12" required />
          {tagTaken && <p className="-mt-2 text-sm font-medium text-red-700">This ear tag is already linked to a registered animal.</p>}
          <Input label="Name / nickname" hint="Optional" value={info.name} onChange={(e) => set('name', e.target.value)} />
          <Select label="Breed" value={info.breed} onChange={(e) => set('breed', e.target.value)} options={BREEDS} />
          <Choice<Sex> label="Sex" value={info.sex} onChange={(v) => set('sex', v)} options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }]} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Birth year" value={info.birth_date} onChange={(e) => set('birth_date', e.target.value)} options={YEARS} />
            <Select label="Colour" value={info.colour} onChange={(e) => set('colour', e.target.value)} options={COLOURS} />
          </div>
          <Input label="Farm" value={info.farm} onChange={(e) => set('farm', e.target.value)} required />
          <Select label="Region" value={info.region} onChange={(e) => set('region', e.target.value)} options={REGIONS} />
          <Button full size="xl" iconRight="arrowRight" disabled={!valid} onClick={() => setStep(1)}>Next: muzzle photos</Button>
        </div>
      )}

      {step === 1 && (
        <div>
          {!online && (
            <div className="mb-4 flex gap-3 rounded-2xl bg-charcoal-900 p-4 text-sm text-white">
              <Icon name="wifiOff" className="shrink-0 text-sand-400" />
              <p>You're offline. The photo and details will be saved on this device as <b>PENDING SYNC</b>. Biometric enrolment and duplicate checking run when connectivity returns.</p>
            </div>
          )}
          <GuidedEnrol onDone={onMuzzle} cta={online ? 'Use photo' : 'Save on device'} />
          <Button variant="ghost" full className="mt-2" icon="arrowLeft" onClick={() => setStep(0)}>Back to details</Button>
        </div>
      )}

      {step === 2 && offlineSaved && created && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-sand-50 p-6 text-center ring-2 ring-sand-400/60">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sand-500 text-charcoal-950"><Icon name="device" size={30} /></div>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.2em] text-sand-700">Saved on device</p>
            <p className="mt-1 text-2xl font-extrabold">PENDING SYNC</p>
            <p className="mt-2 text-sm text-charcoal-700">No connection. Your information is safely stored on this device and will sync when connectivity returns.</p>
            <p className="mt-3 font-mono text-sm text-charcoal-500">Temporary reference: {created.muzzle_id}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-charcoal-900/8">
            <p className="font-bold">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-charcoal-700">
              <li>Connectivity returns → OwaMuzzle syncs automatically.</li>
              <li>Muzzle pattern is enrolled and checked against registered animals.</li>
              <li>A permanent Muzzle ID is issued (e.g. MZ-NA-000847).</li>
            </ol>
          </div>
          <Button full size="xl" iconRight="arrowRight" onClick={() => setStep(3)}>View record</Button>
        </div>
      )}

      {step === 2 && !offlineSaved && capture && (
        <div className="space-y-4">
          {!seqDone ? (
            <>
              <ScanSequence image={capture.image} steps={['Detecting muzzle...', 'Extracting pattern...', 'Checking registration records...', 'Creating biometric identity...']} onDone={finishSequence} />
              <p className="text-center"><ProtoTag>Prototype: feature matching, not yet field-validated</ProtoTag></p>
            </>
          ) : dup && dupAnimal ? (
            <div className="rounded-3xl bg-amber-50 p-5 ring-2 ring-amber-400">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-800"><Icon name="alert" size={16} /> Possible duplicate</p>
              <p className="mt-2 text-lg font-bold">This muzzle closely matches an existing record.</p>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3">
                <AnimalPhoto src={dupAnimal.photo_url} alt="" className="h-14 w-14 rounded-xl" />
                <div><p className="font-mono font-bold">{dupAnimal.muzzle_id}</p><p className="text-sm text-charcoal-500">{dupAnimal.breed} · {dupAnimal.sex} · {dupAnimal.region}</p></div>
              </div>
              <p className="mt-2 text-xs text-charcoal-500">Match confidence {dup.match.confidence}%{dup.match.simulated && <ProtoTag className="ml-1">Simulated</ProtoTag>}</p>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" icon="eye" onClick={() => navigate(`/app/animal/${dupAnimal.id}`)}>View existing record</Button>
                <Button variant="outline" icon="refresh" onClick={() => { setDup(null); setStep(1); }}>Retake muzzle photos</Button>
                <Button variant="ghost" size="md" onClick={registerAnyway}>Register anyway (flag for review)</Button>
              </div>
            </div>
          ) : created ? (
            <div className="fade-up rounded-3xl bg-forest-800 p-8 text-center text-white">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-forest-500 ring-8 ring-forest-500/25"><Icon name="check" size={40} strokeWidth={3} /></div>
              <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.25em] text-sand-400">Identity created</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-tight">{created.muzzle_id}</p>
              <p className="mt-2 text-sm text-white/70">{created.breed} · {created.sex} · tag {created.ear_tag}</p>
              <p className="mt-3"><ProtoTag className="!bg-white/10 !text-sand-200">{captures.length} muzzle angle{captures.length === 1 ? '' : 's'} enrolled</ProtoTag></p>
              <Button variant="sand" full size="xl" className="mt-6" iconRight="arrowRight" onClick={() => setStep(3)}>View identity card</Button>
            </div>
          ) : null}
        </div>
      )}

      {step === 3 && created && (
        <CreatedRecord animalId={created.id} ownerName={user!.full_name} onAnother={() => { setStep(0); setCreated(null); setCaptures([]); setPhoto(undefined); setOfflineSaved(false); setInfo((s) => ({ ...s, ear_tag: '', name: '' })); }} />
      )}
    </div>
  );
}

function CreatedRecord({ animalId, ownerName, onAnother }: { animalId: string; ownerName: string; onAnother: () => void }) {
  const animal = useDB((d) => d.animals.find((a) => a.id === animalId));
  if (!animal) return null;
  return (
    <div className="fade-up space-y-4">
      <p className="flex items-center gap-2 font-bold text-forest-800"><Icon name="checkCircle" /> Record created</p>
      <IdentityCard animal={animal} ownerName={ownerName} />
      <Button full size="xl" icon="eye" onClick={() => navigate(`/app/animal/${animal.id}`)}>Open animal profile</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="md" className="h-12" icon="plus" onClick={onAnother}>Add another</Button>
        <Button variant="outline" size="md" className="h-12" icon="cow" onClick={() => navigate('/app/cattle')}>My livestock</Button>
      </div>
    </div>
  );
}
