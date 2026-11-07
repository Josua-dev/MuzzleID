import { useEffect } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, EmptyState, SectionTitle, toast } from '../components/ui/primitives';
import { AnimalPhoto } from '../components/Brand';
import { Icon, type IconName } from '../components/ui/Icon';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useDB } from '../services/store';
import { acceptTransfer, closeTransfer, markNotificationsRead } from '../services/actions';
import { Link } from '../lib/router';
import { cn, fmtDate, timeAgo } from '../lib/utils';
import type { Notification } from '../types/models';

const KIND: Record<Notification['kind'], { icon: IconName; cls: string }> = {
  ALERT: { icon: 'alert', cls: 'bg-red-100 text-red-700' },
  TRANSFER: { icon: 'transfer', cls: 'bg-blue-100 text-blue-700' },
  CONTACT: { icon: 'message', cls: 'bg-sand-100 text-sand-700' },
  SYNC: { icon: 'refresh', cls: 'bg-forest-100 text-forest-800' },
  INFO: { icon: 'info', cls: 'bg-surface text-charcoal-700' },
};

export default function Alerts() {
  const { user } = useSession();
  const online = useOnline();
  const data = useDB((d) => ({
    incoming: d.transfers.filter((t) => t.status === 'PENDING' && t.buyer_user_id === user!.id).map((t) => ({ t, a: d.animals.find((a) => a.id === t.animal_id)!, seller: d.users.find((u) => u.id === t.seller_id) })),
    notes: d.notifications.filter((n) => n.user_id === user!.id).slice(0, 30),
    reports: d.theftReports.filter((r) => r.status === 'OPEN').map((r) => ({ r, a: d.animals.find((a) => a.id === r.animal_id)! })).filter((x) => x.a).sort((x, y) => y.r.reported_at.localeCompare(x.r.reported_at)),
  }));

  useEffect(() => {
    const t = setTimeout(() => markNotificationsRead(user!.id), 1500);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <div className="fade-up">
      <PageHeader title="Alerts" subtitle="Transfers, messages and reported livestock" />

      {data.incoming.length > 0 && (<>
        <SectionTitle>Incoming transfers</SectionTitle>
        <div className="space-y-3">
          {data.incoming.map(({ t, a, seller }) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="flex items-center justify-between bg-blue-600 px-4 py-2.5 text-white"><span className="text-sm font-black tracking-wide">TRANSFER REQUEST</span><span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700">PENDING</span></div>
              <div className="flex items-center gap-3 p-4">
                <AnimalPhoto src={a.photo_url} alt="" className="h-16 w-16 rounded-xl" />
                <div className="flex-1">
                  <p className="font-mono font-bold">{a.muzzle_id}</p>
                  <p className="text-sm text-charcoal-500">{a.breed} · {a.sex} · {a.colour}</p>
                  <p className="text-sm">From <b>{seller?.full_name}</b></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <Button variant="outline" onClick={() => { closeTransfer(user!, t.id, 'DECLINED', online); toast('Transfer declined', 'warn'); }}>Decline</Button>
                <Button icon="check" onClick={() => { acceptTransfer(user!, t.id, online); toast('Transfer complete. Animal added to your herd'); }}>Accept</Button>
              </div>
            </Card>
          ))}
        </div>
      </>)}

      <SectionTitle>Notifications</SectionTitle>
      {data.notes.length ? (
        <ul className="divide-y divide-charcoal-900/6 rounded-2xl bg-white ring-1 ring-charcoal-900/8">
          {data.notes.map((n) => (
            <li key={n.id}>
              <Link to={n.animal_id ? `/app/animal/${n.animal_id}` : '/app/alerts'} className={cn('flex gap-3 px-4 py-3', !n.read && 'bg-sand-50')}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${KIND[n.kind].cls}`}><Icon name={KIND[n.kind].icon} size={19} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{n.title}{!n.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" />}</p>
                  <p className="text-sm text-charcoal-700">{n.body}</p>
                  <p className="text-xs text-charcoal-500">{timeAgo(n.created_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon="bell" title="You're all caught up" />}

      <SectionTitle>Reported livestock ({data.reports.length})</SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-charcoal-500">Animals currently reported stolen or missing in OwaMuzzle. Owner details are protected.</p>
      <div className="space-y-2">
        {data.reports.map(({ r, a }) => (
          <Link key={r.id} to={`/app/animal/${a.id}`} className={cn('flex items-center gap-3 rounded-2xl bg-white p-3 ring-1', r.type === 'STOLEN' ? 'ring-red-300' : 'ring-amber-300')}>
            <AnimalPhoto src={a.photo_url} alt="" className="h-14 w-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold">{a.muzzle_id}</p>
              <p className="truncate text-xs text-charcoal-500">{a.breed} · {a.colour} · {a.region}</p>
              <p className="text-xs text-charcoal-500">Reported {fmtDate(r.reported_at)}</p>
            </div>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white', r.type === 'STOLEN' ? 'bg-red-600' : 'bg-amber-500')}>{r.type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
