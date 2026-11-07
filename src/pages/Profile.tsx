import { PageHeader, ConnectionIndicator } from '../components/layout/AppShell';
import { Button, Card, KV, ProtoTag, SectionTitle, toast } from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useInstall } from '../hooks/useInstall';
import { resetDemoData, setUI, useDB, useUI } from '../services/store';
import { pendingCount, processQueue } from '../services/sync';
import { demoSignIn, signOut } from '../services/auth';
import { supabaseEnabled } from '../services/supabase';
import { biometrics } from '../services/biometric';
import { ROLE_LABEL } from '../lib/permissions';
import { DEMO_ACCOUNTS } from '../data/demoData';
import { navigate } from '../lib/router';
import { cn, fmtDateTime } from '../lib/utils';

export default function Profile() {
  const { user, profile } = useSession();
  const online = useOnline();
  const ui = useUI();
  const pwa = useInstall();
  const queue = useDB((d) => d.syncQueue.slice().reverse().slice(0, 8));
  const pending = useDB(pendingCount);
  const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  const toggleOffline = () => {
    setUI({ simulateOffline: !ui.simulateOffline });
    toast(ui.simulateOffline ? 'Connection restored' : 'Offline mode on. No network will be used', ui.simulateOffline ? 'ok' : 'warn');
  };

  return (
    <div className="fade-up">
      <PageHeader title="Profile" />
      <Card className="flex items-center gap-4 p-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-800 text-2xl font-extrabold text-white">{user!.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold">{user!.full_name}</p>
          <p className="text-sm text-charcoal-500">{ROLE_LABEL[user!.role]}{user!.organisation ? ` · ${user!.organisation}` : ''}</p>
          <p className="text-sm text-charcoal-500">{user!.phone}</p>
        </div>
      </Card>
      {profile && <Card className="mt-3 px-4 py-1"><KV k="Farm" v={profile.farm_name} /><KV k="Region" v={profile.region} /></Card>}

      <SectionTitle>Connectivity & sync</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center justify-between"><p className="font-bold">Status</p><ConnectionIndicator /></div>
        <button onClick={toggleOffline} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left">
          <Icon name={ui.simulateOffline ? 'wifiOff' : 'wifi'} className={ui.simulateOffline ? 'text-charcoal-900' : 'text-forest-700'} />
          <div className="flex-1"><p className="font-bold">Offline mode</p><p className="text-xs text-charcoal-500">Demonstrate off-grid use without disconnecting the device.</p></div>
          <span className={cn('relative h-8 w-14 rounded-full transition-colors', ui.simulateOffline ? 'bg-charcoal-900' : 'bg-charcoal-900/15')}>
            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', ui.simulateOffline ? 'left-7' : 'left-1')} />
          </span>
        </button>
        {!browserOnline && <p className="mt-2 text-xs text-charcoal-500">Your device has no network connection.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="md" variant="secondary" icon="refresh" disabled={!online || !pending || ui.syncPhase === 'syncing'} onClick={() => processQueue().then((n) => n && toast(`${n} item${n > 1 ? 's' : ''} synced`))}>Sync now</Button>
          <div className="rounded-xl bg-surface px-3 py-2 text-xs"><p className="text-charcoal-500">Pending</p><p className="text-base font-extrabold">{pending}</p></div>
        </div>
        {ui.lastSyncAt && <p className="mt-2 text-xs text-charcoal-500">Last sync: {fmtDateTime(ui.lastSyncAt)}</p>}
        {queue.length > 0 && (
          <ul className="mt-3 divide-y divide-charcoal-900/6 rounded-xl ring-1 ring-charcoal-900/8">
            {queue.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{q.label}</span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold', q.status === 'SYNCED' ? 'bg-forest-100 text-forest-800' : q.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-sand-100 text-sand-700')}>{q.status === 'PENDING' ? 'PENDING SYNC' : q.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>App</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Icon name="device" className="text-forest-700" />
          <div className="flex-1"><p className="font-bold">Install OwaMuzzle</p><p className="text-xs text-charcoal-500">{pwa.installed ? 'Installed on this device.' : 'Add to your home screen for offline access.'}</p></div>
          {pwa.canInstall && <Button size="md" onClick={pwa.install}>Install</Button>}
        </div>
        {!pwa.canInstall && !pwa.installed && <p className="mt-2 text-xs text-charcoal-500">On Android: browser menu → “Install app”. On iPhone: Share → “Add to Home Screen”.</p>}
      </Card>
      <Card className="mt-3 px-4 py-1">
        <KV k="Data mode" v={supabaseEnabled() ? 'Supabase connected' : 'Demo mode (on device)'} />
        <KV k="Biometric engine" v={<span className="inline-flex items-center gap-1.5">{biometrics().name}{biometrics().simulated && <ProtoTag />}</span>} />
      </Card>

      {user!.is_demo && (<>
        <SectionTitle>Demo</SectionTitle>
        <Card className="p-4">
          <p className="mb-3 text-sm text-charcoal-500">Switch role to show each experience.</p>
          <div className="grid grid-cols-2 gap-2">
            {([['FARMER', 'Farmer'], ['VET', 'Veterinary'], ['VERIFIER', 'Verification'], ['ADMIN', 'Admin']] as const).map(([r, l]) => (
              <Button key={r} size="md" variant={user!.id === DEMO_ACCOUNTS[r] ? 'primary' : 'outline'} onClick={() => { demoSignIn(DEMO_ACCOUNTS[r]); navigate('/app'); }}>{l}</Button>
            ))}
          </div>
          <Button size="md" variant="ghost" full className="mt-3" icon="refresh" onClick={() => { if (confirm('Reset all demo data on this device?')) { resetDemoData(); setUI({ simulateOffline: false }); demoSignIn(DEMO_ACCOUNTS.FARMER); navigate('/app'); toast('Demo data reset'); } }}>Reset demo data</Button>
        </Card>
      </>)}

      <SectionTitle>Privacy</SectionTitle>
      <Card className="p-4 text-sm text-charcoal-700">
        <p className="flex gap-2"><Icon name="lock" size={18} className="shrink-0 text-forest-700" /> Owner phone numbers are never shown to other users. Contact happens through in-app messages. Every important action is recorded in an audit log.</p>
      </Card>

      <Button full variant="outline" icon="logout" className="mt-6" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</Button>
      <p className="mt-6 text-center text-xs text-charcoal-400">OwaMuzzle prototype · v0.1</p>
    </div>
  );
}
