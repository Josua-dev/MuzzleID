import { useState, type FormEvent } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button, Input, ProtoTag } from '../../components/ui/primitives';
import { requestPasswordReset } from '../../services/auth';
import { Link } from '../../lib/router';
import { Icon } from '../../components/ui/Icon';

export default function ForgotPassword() {
  const [id, setId] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'demo'>('idle');
  const submit = async (e: FormEvent) => { e.preventDefault(); setState(await requestPasswordReset(id)); };
  return (
    <AuthLayout title="Reset password" subtitle="We'll send reset instructions if an account exists.">
      {state === 'idle' ? (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Phone or email" value={id} onChange={(e) => setId(e.target.value)} required />
          <Button full>Send reset link</Button>
        </form>
      ) : (
        <div className="rounded-2xl bg-forest-50 p-5 ring-1 ring-forest-600/20">
          <Icon name="checkCircle" className="text-forest-700" size={28} />
          <p className="mt-2 font-bold">Check your messages</p>
          <p className="text-sm text-charcoal-700">If an account exists for <b>{id}</b>, reset instructions have been sent.</p>
          {state === 'demo' && <p className="mt-3 text-sm text-charcoal-500"><ProtoTag>Demo mode</ProtoTag> No email or SMS is sent in Demo Mode. Demo accounts use password <b className="font-mono">demo1234</b>.</p>}
        </div>
      )}
      <p className="mt-5 text-center text-sm"><Link to="/signin" className="font-semibold text-forest-700">Back to sign in</Link></p>
    </AuthLayout>
  );
}
