import { useState, type FormEvent } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button, Choice, Input, Select, toast } from '../../components/ui/primitives';
import { signUp } from '../../services/auth';
import { Link, navigate } from '../../lib/router';
import { REGIONS } from '../../lib/utils';
import type { Role } from '../../types/models';

export default function SignUp() {
  const [role, setRole] = useState<Role>('FARMER');
  const [f, setF] = useState({ full_name: '', phone: '+264 ', email: '', farm_name: '', region: 'Omaheke', organisation: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (f.password.length < 8) return setErr('Password must be at least 8 characters.');
    if (f.phone.replace(/\D/g, '').length < 9) return setErr('Enter a valid phone number.');
    setBusy(true);
    try {
      await signUp({ ...f, role, farm_name: role === 'FARMER' ? f.farm_name : '', organisation: role === 'FARMER' ? undefined : f.organisation });
      toast('Account created');
      navigate('/app');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Create account" subtitle="It takes less than a minute.">
      <form onSubmit={submit} className="space-y-4">
        <Choice label="I am a" value={role} onChange={setRole} options={[
          { value: 'FARMER', label: 'Farmer', icon: 'cow' }, { value: 'VET', label: 'Vet (prototype)', icon: 'stethoscope' },
          { value: 'VERIFIER', label: 'Verifier (prototype)', icon: 'shieldCheck' },
        ]} cols={3} />
        <Input label="Full name" value={f.full_name} onChange={set('full_name')} required autoComplete="name" />
        <Input label="Phone number" type="tel" value={f.phone} onChange={set('phone')} required autoComplete="tel" />
        <Input label="Email" hint="Optional" type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        {role === 'FARMER' ? (<>
          <Input label="Farm name" value={f.farm_name} onChange={set('farm_name')} required />
          <Select label="Region" value={f.region} onChange={set('region')} options={REGIONS} />
        </>) : (
          <Input label="Organisation" hint="Prototype role" value={f.organisation} onChange={set('organisation')} required />
        )}
        <Input label="Password" type="password" value={f.password} onChange={set('password')} required autoComplete="new-password" hint="Min. 8 characters" />
        {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</p>}
        <Button full disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-center text-sm">Already registered? <Link to="/signin" className="font-semibold text-forest-700">Sign in</Link></p>
    </AuthLayout>
  );
}
