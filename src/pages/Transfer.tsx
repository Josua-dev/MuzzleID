import { useState } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, EmptyState, Input, ProtoTag, Select, toast } from '../components/ui/primitives';
import { AnimalPhoto } from '../components/Brand';
import { Icon } from '../components/ui/Icon';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useDB } from '../services/store';
import { acceptTransfer, closeTransfer, createTransfer } from '../services/actions';
import { demoSignIn } from '../services/auth';
import { navigate, useRoute } from '../lib/router';
import { cn, fmtDate } from '../lib/utils';
import type { TransferRequest } from '../types/models';

const STATUS_CLS: Record<TransferRequest['status'], string> = {
  PENDING: 'bg-blue-100 text-blue-800', ACCEPTED: 'bg-forest-100 text-forest-800', DECLINED: 'bg-red-100 text-red-700', CANCELLED: 'bg-surface text-charcoal-500',
};

export default function Transfer() {
  const { user } = useSession();
  const online = useOnline();
  const { query } = useRoute();
  const [animalId, setAnimalId] = useState(query.get('animal') ?? '');
  const [buyer, setBuyer] = useState({ phone: '+264 ', name: '', userId: '' });
  const [created, setCreated] = useState<string | null>(null);

  const data = useDB((d) => ({
    eligible: d.animals.filter((a) => a.owner_id === user!.id && a.status === 'ACTIVE' && !a.muzzle_id.startsWith('PENDING')),
    farmers: d.users.filter((u) => u.role === 'FARMER' && u.id !== user!.id && u.active),
    outgoing: d.transfers.filter((t) => t.seller_id === user!.id).map((t) => ({ t, a: d.animals.find((a) => a.id === t.animal_id)! })).filter((x) => x.a),
  }));
  const animal = data.eligible.find((a) => a.id === animalId);
  const phoneMatch = data.farmers.find((u) => u.phone.replace(/\D/g, '') === buyer.phone.replace(/\D/g, '') && buyer.phone.replace(/\D/g, '').length > 8);
  const linked = data.farmers.find((u) => u.id === buyer.userId) ?? phoneMatch;
  const createdT = data.outgoing.find((x) => x.t.id === created);

  const submit = () => {
    if (!animal) return;
    if (buyer.phone.replace(/\D/g, '').length < 9 || !buyer.name.trim()) return toast('Enter buyer name and phone', 'warn');
    const t = createTransfer(user!, animal.id, { name: buyer.name.trim(), phone: buyer.phone.trim(), userId: linked?.id }, online);
    setCreated(t.id);
    toast('Transfer request created');
  };

  const pickAccount = (id: string) => {
    const u = data.farmers.find((x) => x.id === id);
    setBuyer(u ? { phone: u.phone, name: u.full_name, userId: u.id } : { ...buyer, userId: '' });
  };

  return (
    <div className="fade-up">
      <PageHeader title="Ownership transfer" subtitle="Sell or hand over an animal digitally" backTo="/app" />

      {createdT ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-charcoal-900/8">
            <div className="flex items-center justify-between bg-blue-600 px-5 py-4 text-white">
              <p className="text-lg font-black tracking-wide">TRANSFER REQUEST</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">{createdT.t.status}</span>
            </div>
            <div className="flex items-center gap-3 p-4">
              <AnimalPhoto src={createdT.a.photo_url} alt="" className="h-16 w-16 rounded-xl" />
              <div className="flex-1"><p className="font-mono font-bold">{createdT.a.muzzle_id}</p><p className="text-sm text-charcoal-500">{createdT.a.breed} · {createdT.a.sex}</p></div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-charcoal-900/8 p-4 text-sm">
              <div><p className="text-xs text-charcoal-500">From</p><p className="font-bold">{user!.full_name}</p></div>
              <Icon name="arrowRight" className="text-blue-600" />
              <div className="text-right"><p className="text-xs text-charcoal-500">To</p><p className="font-bold">{createdT.t.buyer_name}</p></div>
            </div>
          </div>
          <TransferActions t={createdT.t} />
          <Button full variant="ghost" onClick={() => { setCreated(null); setAnimalId(''); setBuyer({ phone: '+264 ', name: '', userId: '' }); }}>Done</Button>
        </div>
      ) : !animal ? (
        <>
          <p className="mb-2 text-sm font-semibold text-charcoal-700">1. Select animal</p>
          {data.eligible.length ? (
            <div className="space-y-2">
              {data.eligible.map((a) => (
                <button key={a.id} onClick={() => setAnimalId(a.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-charcoal-900/8 hover:ring-forest-600">
                  <AnimalPhoto src={a.photo_url} alt="" className="h-14 w-14 rounded-xl" />
                  <div className="flex-1"><p className="font-mono font-bold">{a.muzzle_id}</p><p className="text-sm text-charcoal-500">{a.name ? `${a.name} · ` : ''}{a.breed} · tag {a.ear_tag}</p></div>
                  <Icon name="chevronRight" className="text-charcoal-400" />
                </button>
              ))}
            </div>
          ) : <EmptyState icon="cow" title="No animals available to transfer" body="Animals that are missing, stolen, pending sync or already in a transfer can't be transferred." />}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/8">
            <AnimalPhoto src={animal.photo_url} alt="" className="h-14 w-14 rounded-xl" />
            <div className="flex-1"><p className="font-mono font-bold">{animal.muzzle_id}</p><p className="text-sm text-charcoal-500">{animal.breed} · {animal.sex}</p></div>
            <button onClick={() => setAnimalId('')} className="text-sm font-semibold text-forest-700">Change</button>
          </div>
          <p className="text-sm font-semibold text-charcoal-700">2. Buyer details</p>
          <Select label="MuzzleID user account" hint="Optional" value={buyer.userId} onChange={(e) => pickAccount(e.target.value)}
            options={[{ value: '', label: 'Not selected — enter details' }, ...data.farmers.map((u) => ({ value: u.id, label: `${u.full_name} (${u.phone})` }))]} />
          <Input label="Buyer phone" type="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value, userId: '' })} />
          <Input label="Buyer name" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
          {linked ? (
            <p className="flex items-center gap-2 rounded-xl bg-forest-50 px-3 py-2.5 text-sm font-semibold text-forest-800"><Icon name="checkCircle" size={18} /> Linked to MuzzleID account: {linked.full_name}</p>
          ) : (
            <p className="rounded-xl bg-surface px-3 py-2.5 text-sm text-charcoal-500">Buyer has no linked account. They will confirm when they register with this phone number.</p>
          )}
          <Button full size="xl" icon="transfer" onClick={submit}>Create transfer request</Button>
        </div>
      )}

      {!createdT && data.outgoing.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.14em] text-charcoal-500">Your transfers</h2>
          <div className="space-y-2">
            {data.outgoing.map(({ t, a }) => (
              <Card key={t.id} className="p-3">
                <div className="flex items-center gap-3">
                  <AnimalPhoto src={a.photo_url} alt="" className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold">{a.muzzle_id}</p>
                    <p className="truncate text-xs text-charcoal-500">To {t.buyer_name} · {fmtDate(t.created_at)}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold', STATUS_CLS[t.status])}>{t.status}</span>
                </div>
                {t.status === 'PENDING' && <div className="mt-3"><TransferActions t={t} compact /></div>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TransferActions({ t, compact }: { t: TransferRequest; compact?: boolean }) {
  const { user } = useSession();
  const online = useOnline();
  if (t.status !== 'PENDING') return (
    <p className="flex items-center gap-2 rounded-xl bg-forest-50 px-3 py-3 font-bold text-forest-800"><Icon name="checkCircle" /> TRANSFER COMPLETE</p>
  );
  return (
    <div className={cn('space-y-2', !compact && 'rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/8')}>
      {!compact && <p className="text-sm text-charcoal-700">{t.buyer_user_id ? 'Waiting for the buyer to accept in their MuzzleID app.' : 'The buyer has no MuzzleID account yet.'}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button size="md" variant="outline" onClick={() => { closeTransfer(user!, t.id, 'CANCELLED', online); toast('Transfer cancelled', 'warn'); }}>Cancel</Button>
        {t.buyer_user_id ? (
          <Button size="md" icon="user" onClick={() => { demoSignIn(t.buyer_user_id!); navigate('/app/alerts'); toast(`Signed in as ${t.buyer_name} (demo)`); }}>Open as buyer</Button>
        ) : (
          <Button size="md" icon="check" onClick={() => { acceptTransfer(user!, t.id, online); toast('Transfer complete'); }}>Buyer confirms</Button>
        )}
      </div>
      <p className="text-center"><ProtoTag>{t.buyer_user_id ? 'Demo: switch to buyer account' : 'Demo: on-behalf confirmation'}</ProtoTag></p>
    </div>
  );
}
