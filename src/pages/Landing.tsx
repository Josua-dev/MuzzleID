import { useState } from 'react';
import { asset } from '../lib/assets';
import { Logo, MuzzlePattern } from '../components/Brand';
import { Icon, type IconName } from '../components/ui/Icon';
import { Link, navigate } from '../lib/router';
import { cn } from '../lib/utils';
import { useSession } from '../hooks/useSession';

const STEPS: { n: string; title: string; body: string; icon: IconName }[] = [
  { n: '1', title: 'Capture', body: 'Take a clear muzzle photo.', icon: 'camera' },
  { n: '2', title: 'Identify', body: 'OwaMuzzle analyses the muzzle pattern.', icon: 'fingerprint' },
  { n: '3', title: 'Register', body: "Create the animal's digital record.", icon: 'database' },
  { n: '4', title: 'Verify', body: 'Scan later to retrieve and verify the animal.', icon: 'shieldCheck' },
];

const USES: { t: string; icon: IconName; note?: string }[] = [
  { t: 'Livestock identification', icon: 'fingerprint' },
  { t: 'Ownership verification', icon: 'shieldCheck' },
  { t: 'Livestock records', icon: 'file' },
  { t: 'Theft recovery support', icon: 'alert' },
  { t: 'Animal health records', icon: 'syringe' },
  { t: 'Traceability', icon: 'route' },
  { t: 'Insurance verification', icon: 'shield', note: 'Future potential' },
];

function Comparison() {
  const [side, setSide] = useState<'trad' | 'mz'>('mz');
  const trad = [
    { t: 'Ear tag', d: 'Can be removed, lost, damaged or swapped.', icon: 'tag' as IconName },
    { t: 'Branding', d: 'A physical mark, but it holds almost no digital information.', icon: 'flag' as IconName },
    { t: 'Paper records', d: 'Hard to search, easy to lose, slow to verify in the field.', icon: 'file' as IconName },
  ];
  const mz = [
    { t: 'Biometric characteristic', d: "Uses the animal's own natural muzzle pattern.", icon: 'fingerprint' as IconName },
    { t: 'Non-invasive capture', d: 'A phone photo. No marking, no cutting, no stress.', icon: 'camera' as IconName },
    { t: 'Linked digital identity', d: 'Owner, farm, health and history in one record.', icon: 'database' as IconName },
    { t: 'Searchable history', d: 'Timeline of vaccinations, transfers and reports.', icon: 'route' as IconName },
    { t: 'Additional identification layer', d: 'Works next to ear tags and branding. It does not replace them.', icon: 'layers' as IconName },
  ];
  const list = side === 'trad' ? trad : mz;
  return (
    <div className="rounded-3xl bg-white p-2 ring-1 ring-charcoal-900/8">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        <button onClick={() => setSide('trad')} className={cn('rounded-xl py-3 text-sm font-extrabold tracking-wide', side === 'trad' ? 'bg-charcoal-900 text-white' : 'text-charcoal-500')}>TRADITIONAL</button>
        <button onClick={() => setSide('mz')} className={cn('rounded-xl py-3 text-sm font-extrabold tracking-wide', side === 'mz' ? 'bg-forest-800 text-white' : 'text-charcoal-500')}>MUZZLEID</button>
      </div>
      <ul className="grid gap-2 p-3 sm:grid-cols-2">
        {list.map((x) => (
          <li key={x.t} className="fade-up flex gap-3 rounded-2xl border border-charcoal-900/8 p-4">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', side === 'trad' ? 'bg-charcoal-900/8 text-charcoal-700' : 'bg-forest-100 text-forest-800')}><Icon name={x.icon} /></span>
            <div><p className="font-bold">{x.t}</p><p className="text-sm text-charcoal-500">{x.d}</p></div>
          </li>
        ))}
      </ul>
      <p className="px-4 pb-3 text-xs text-charcoal-500">OwaMuzzle does not replace legally required livestock identification or branding. It is an additional digital identification and verification layer.</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useSession();
  const register = () => navigate(user ? '/app/register' : '/signup');
  return (
    <div className="bg-white">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo light />
          <Link to={user ? '/app' : '/signin'} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25">{user ? 'Open app' : 'Sign in'}</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-forest-950 text-white">
        <img src={asset('/demo/hero.jpg')} alt="Brahman cow on a Namibian farm" className="absolute inset-0 h-full w-full object-cover object-[60%_35%] opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-forest-950/70 via-forest-950/40 to-forest-950" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-28 md:grid-cols-[1.2fr_1fr] md:pb-24 md:pt-36">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sand-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-sand-200 ring-1 ring-sand-400/40">
              <Icon name="fingerprint" size={14} /> Livestock digital identity
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Every Animal Has an Identity.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">Photograph an animal's muzzle to register it. Scan it later to pull up its owner, health history and any theft report.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate('/signin')} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-sand-500 px-7 text-base font-extrabold tracking-wide text-charcoal-950 hover:bg-sand-400"><Icon name="scan" /> TRY DEMO</button>
              <button onClick={register} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white/10 px-7 text-base font-extrabold tracking-wide text-white ring-2 ring-white/40 hover:bg-white/20"><Icon name="plus" /> REGISTER LIVESTOCK</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              <span className="flex items-center gap-2"><Icon name="wifiOff" size={16} className="text-sand-400" /> Works offline</span>
              <span className="flex items-center gap-2"><Icon name="device" size={16} className="text-sand-400" /> Any smartphone</span>
              <span className="flex items-center gap-2"><Icon name="lock" size={16} className="text-sand-400" /> Owner details masked by default</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="relative aspect-square overflow-hidden rounded-[42%] ring-4 ring-sand-400/70 shadow-2xl">
              <img src={asset('/demo/muzzle-hero.jpg')} alt="Close-up of a cow's muzzle pattern" className="h-full w-full object-cover" />
              <div className="scanline" />
            </div>
            <div className="absolute -bottom-4 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl bg-white p-3 text-charcoal-900 shadow-xl">
              <div className="flex items-center gap-3">
                <MuzzlePattern seed="MZ-NA-000238" className="h-10 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-forest-700">Match found</p>
                  <p className="font-mono text-base font-bold">MZ-NA-000238</p>
                </div>
                <span className="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-extrabold text-forest-800">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem + Idea */}
      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-16 md:grid-cols-2">
        <div className="rounded-3xl bg-charcoal-900 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sand-400">The problem</p>
          <h2 className="mt-3 text-2xl font-extrabold">Physical identification can be lost, removed, damaged or altered.</h2>
          <p className="mt-3 text-white/70">When an ear tag disappears, so does the link between the animal, its owner and its history. Records on paper are hard to check in the field.</p>
        </div>
        <div className="rounded-3xl bg-forest-800 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sand-400">The idea</p>
          <h2 className="mt-3 text-2xl font-extrabold">Use the animal's natural muzzle pattern as an additional biometric identity.</h2>
          <p className="mt-3 text-white/70">Like a fingerprint, the ridges and beads on a cow's muzzle form a pattern that is different on every animal. You capture it with a phone and link it to the animal's record.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sand-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sand-700">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">From photo to register entry</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-3xl bg-white p-6 ring-1 ring-charcoal-900/8">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-800 text-white"><Icon name={s.icon} /></span>
                  <span className="text-4xl font-extrabold text-sand-200">{s.n}</span>
                </div>
                <p className="mt-4 text-lg font-extrabold uppercase tracking-wide">{s.title}</p>
                <p className="text-charcoal-500">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-700">Compare</p>
        <h2 className="mb-6 mt-2 text-3xl font-extrabold tracking-tight">Traditional identification vs OwaMuzzle</h2>
        <Comparison />
      </section>

      {/* Use cases */}
      <section className="bg-forest-950 py-16 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sand-400">Use cases</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">What it is for</h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {USES.map((u) => (
              <li key={u.t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <Icon name={u.icon} className="text-sand-400" size={26} />
                <p className="mt-3 font-bold">{u.t}</p>
                {u.note && <p className="mt-1 text-xs text-white/50">{u.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Built for off-grid */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-16 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-700">Offline</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Works with no signal.</h2>
          <p className="mt-3 text-charcoal-500">Install it on your phone. Registrations made without signal are saved on the device as <b>pending sync</b> and upload when you are back in range.</p>
        </div>
        <ul className="space-y-3 text-charcoal-700">
          <li className="rounded-2xl border border-charcoal-900/8 p-4"><b>No signal:</b> you can still register an animal, check one against the records on the phone, and add a health note.</li>
          <li className="rounded-2xl border border-charcoal-900/8 p-4"><b>Back in range:</b> pending items upload on their own.</li>
          <li className="rounded-2xl border border-charcoal-900/8 p-4"><b>Duplicates:</b> a new animal that looks like one already registered is flagged for review.</li>
        </ul>
      </section>

      {/* CTA */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-6xl rounded-3xl bg-forest-800 px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight">Try it with the demo herd.</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/75">The demo has sample farmers and cattle, a stolen-animal alert and offline sync you can switch on and off.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/signin')} className="h-14 rounded-xl bg-sand-500 px-8 font-extrabold tracking-wide text-charcoal-950 hover:bg-sand-400">TRY DEMO</button>
            <button onClick={register} className="h-14 rounded-xl bg-white/10 px-8 font-extrabold tracking-wide ring-2 ring-white/40 hover:bg-white/20">REGISTER LIVESTOCK</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-charcoal-900/8 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-charcoal-500 md:flex-row md:items-center md:justify-between">
          <Logo tagline />
          <p className="max-w-xl text-xs">Prototype. Biometric matching in this version is simulated for demonstration. OwaMuzzle is an additional digital identification layer and does not replace legally required livestock identification. No government, police, veterinary-authority or insurer integrations are implied. All demo people, farms and records are fictional.</p>
        </div>
      </footer>
    </div>
  );
}
