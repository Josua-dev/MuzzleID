import { useDB } from '../../services/store';
import { useSession } from '../../hooks/useSession';
import { herdFor } from '../../services/queries';
import { firstName, greeting } from '../../lib/utils';
import { Icon, type IconName } from '../../components/ui/Icon';
import { Link } from '../../lib/router';
import { SectionTitle } from '../../components/ui/primitives';
import { ActivityList } from '../../components/ActivityList';
import { AnimalPhoto } from '../../components/Brand';

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: IconName }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/8">
      <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon name={icon} size={18} /></div>
      <p className="text-3xl font-extrabold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-charcoal-500">{label}</p>
    </div>
  );
}

function Action({ to, label, icon, primary, danger }: { to: string; label: string; icon: IconName; primary?: boolean; danger?: boolean }) {
  return (
    <Link to={to} className={`flex min-h-[104px] flex-col justify-between rounded-2xl p-4 font-extrabold uppercase tracking-wide transition-colors ${
      primary ? 'bg-forest-800 text-white hover:bg-forest-700' : danger ? 'bg-white text-red-700 ring-2 ring-red-200 hover:ring-red-400' : 'bg-white text-charcoal-900 ring-1 ring-charcoal-900/10 hover:ring-forest-600'}`}>
      <Icon name={icon} size={30} />
      <span className="text-[15px] leading-tight">{label}</span>
    </Link>
  );
}

export default function FarmerDashboard() {
  const { user, profile } = useSession();
  const data = useDB((d) => {
    const { owned } = herdFor(d, user!.id);
    const ids = new Set(owned.map((a) => a.muzzle_id));
    const prevIds = new Set(d.ownership.filter((o) => o.owner_id === user!.id).map((o) => d.animals.find((a) => a.id === o.animal_id)?.muzzle_id));
    return {
      owned,
      registered: owned.filter((a) => !a.muzzle_id.startsWith('PENDING')).length,
      healthy: owned.filter((a) => a.health_status === 'HEALTHY' && a.status !== 'STOLEN' && a.status !== 'MISSING').length,
      flagged: owned.filter((a) => a.status === 'STOLEN' || a.status === 'MISSING'),
      activity: d.audit.filter((l) => l.actor_id === user!.id || (l.target && (ids.has(l.target) || prevIds.has(l.target)))).filter((l) => !l.action.startsWith('SIGNED_IN')).slice(0, 6),
      incoming: d.transfers.filter((t) => t.status === 'PENDING' && t.buyer_user_id === user!.id),
    };
  });

  return (
    <div className="fade-up">
      <div className="mb-4">
        <p className="text-sm font-semibold text-charcoal-500">{profile?.farm_name}{profile?.region ? ` · ${profile.region}` : ''}</p>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{greeting()}, {firstName(user!.full_name)}</h1>
      </div>

      {data.flagged.length > 0 && (
        <Link to={`/app/animal/${data.flagged[0].id}`} className="mb-4 flex items-center gap-3 rounded-2xl bg-red-600 p-3 text-white">
          <AnimalPhoto src={data.flagged[0].photo_url} alt="" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">{data.flagged.length} animal{data.flagged.length > 1 ? 's' : ''} reported</p>
            <p className="truncate font-bold">{data.flagged[0].muzzle_id} · {data.flagged[0].status === 'STOLEN' ? 'Stolen' : 'Missing'}</p>
          </div>
          <Icon name="chevronRight" />
        </Link>
      )}

      {data.incoming.length > 0 && (
        <Link to="/app/alerts" className="mb-4 flex items-center gap-3 rounded-2xl bg-blue-600 p-4 text-white">
          <Icon name="transfer" size={26} />
          <p className="flex-1 font-bold">{data.incoming.length} incoming ownership transfer{data.incoming.length > 1 ? 's' : ''} to accept</p>
          <Icon name="chevronRight" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total cattle" value={data.owned.length} tone="bg-forest-800 text-white" icon="cow" />
        <Stat label="Registered" value={data.registered} tone="bg-forest-100 text-forest-800" icon="fingerprint" />
        <Stat label="Healthy" value={data.healthy} tone="bg-sand-100 text-sand-700" icon="checkCircle" />
        <Stat label="Missing / Stolen" value={data.flagged.length} tone="bg-red-100 text-red-700" icon="alert" />
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Action to="/app/scan" label="Scan animal" icon="scan" primary />
        <Action to="/app/register" label="Register cattle" icon="plus" />
        <Action to="/app/cattle" label="My livestock" icon="cow" />
        <Action to="/app/report" label="Report missing" icon="alert" danger />
      </div>

      <SectionTitle action={<Link to="/app/transfer" className="text-sm font-semibold text-forest-700">Transfer ownership</Link>}>Recent activity</SectionTitle>
      <ActivityList logs={data.activity} />
    </div>
  );
}
