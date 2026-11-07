import { useState, type FormEvent } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button, Input, ProtoTag, toast } from '../../components/ui/primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import { demoSignIn, signIn } from '../../services/auth';
import { Link, navigate } from '../../lib/router';
import { DEMO_ACCOUNTS } from '../../data/demoData';
import { supabaseEnabled } from '../../services/supabase';

const DEMOS: { id: string; role: string; name: string; desc: string; icon: IconName; cls: string }[] = [
  { id: DEMO_ACCOUNTS.FARMER, role: 'Farmer', name: 'Petrus Haufiku', desc: 'Omuramba Farm · Omaheke', icon: 'cow', cls: 'bg-forest-800 text-white' },
  { id: DEMO_ACCOUNTS.VET, role: 'Veterinary', name: 'Dr. Selma Nangolo', desc: 'Add vaccinations & treatments', icon: 'stethoscope', cls: 'bg-forest-100 text-forest-900' },
  { id: DEMO_ACCOUNTS.VERIFIER, role: 'Verification', name: 'Linus Tjiramba', desc: 'Check ownership & theft status', icon: 'shieldCheck', cls: 'bg-sand-100 text-sand-700' },
  { id: DEMO_ACCOUNTS.ADMIN, role: 'Admin', name: 'MuzzleID Admin', desc: 'Statistics, users, reports, logs', icon: 'chart', cls: 'bg-charcoal-900 text-white' },
];

export default function SignIn() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { const u = await signIn(id, pw); toast(`Welcome, ${u.full_name.split(' ')[0]}`); navigate('/app'); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  const demo = (uid: string) => { demoSignIn(uid); navigate('/app'); };

  return (
    <AuthLayout title="Sign in" subtitle="Use your phone number or email.">
      <section className="mb-7 rounded-3xl bg-white p-4 ring-1 ring-charcoal-900/8">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">Demo accounts</p>
          <ProtoTag>Demo data</ProtoTag>
        </div>
        <div className="grid gap-2">
          {DEMOS.map((d) => (
            <button key={d.id} onClick={() => demo(d.id)} className="flex items-center gap-3 rounded-2xl border-2 border-charcoal-900/8 p-3 text-left hover:border-forest-600">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${d.cls}`}><Icon name={d.icon} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-forest-700">{d.role}</span>
                <span className="block font-bold">{d.name}</span>
                <span className="block truncate text-xs text-charcoal-500">{d.desc}</span>
              </span>
              <Icon name="arrowRight" size={18} className="text-charcoal-400" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-charcoal-500">Demo password for all accounts: <b className="font-mono">demo1234</b></p>
      </section>

      <form onSubmit={submit} className="space-y-4">
        <Input label="Phone or email" value={id} onChange={(e) => setId(e.target.value)} placeholder="+264 81 555 0101" autoComplete="username" required />
        <Input label="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</p>}
        <Button full disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm font-semibold">
        <Link to="/forgot" className="text-forest-700">Forgot password?</Link>
        <Link to="/signup" className="text-forest-700">Create account</Link>
      </div>
      <p className="mt-6 text-center text-xs text-charcoal-500">{supabaseEnabled() ? 'Secure sign-in via Supabase Auth.' : 'Demo Mode: accounts are stored on this device only.'}</p>
    </AuthLayout>
  );
}
