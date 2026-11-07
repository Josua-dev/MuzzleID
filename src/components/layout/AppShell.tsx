import { useEffect, useRef, type ReactNode } from 'react';
import { Logo } from '../Brand';
import { Icon, type IconName } from '../ui/Icon';
import { Link, useRoute } from '../../lib/router';
import { cn } from '../../lib/utils';
import { useOnline } from '../../hooks/useOnline';
import { useDB, useUI } from '../../services/store';
import { pendingCount, processQueue } from '../../services/sync';
import { useSession } from '../../hooks/useSession';
import { ROLE_LABEL } from '../../lib/permissions';
import { toast } from '../ui/primitives';

export function ConnectionIndicator() {
  const online = useOnline();
  const ui = useUI();
  const pending = useDB(pendingCount);
  if (ui.syncPhase === 'syncing') return <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-xs font-extrabold tracking-wider text-sand-700"><Icon name="refresh" size={14} className="animate-spin" /> SYNCING…</span>;
  if (ui.syncPhase === 'complete') return <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1.5 text-xs font-extrabold tracking-wider text-forest-800"><Icon name="checkCircle" size={14} /> SYNC COMPLETE</span>;
  return online ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1.5 text-xs font-extrabold tracking-wider text-forest-800 ring-1 ring-forest-600/20"><span className="h-2 w-2 rounded-full bg-forest-500" /> ONLINE</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal-900 px-3 py-1.5 text-xs font-extrabold tracking-wider text-white"><Icon name="wifiOff" size={14} /> OFFLINE{pending ? ` · ${pending}` : ''}</span>
  );
}

function OfflineBanner() {
  const online = useOnline();
  const pending = useDB(pendingCount);
  if (online) return null;
  return (
    <div className="bg-charcoal-900 px-4 py-2.5 text-[13px] text-white">
      <div className="mx-auto flex max-w-screen-sm items-start gap-2">
        <Icon name="device" size={16} className="mt-0.5 shrink-0 text-sand-400" />
        <span>No connection. Your information is safely stored on this device and will sync when connectivity returns.{pending > 0 && <b className="text-sand-400"> {pending} pending.</b>}</span>
      </div>
    </div>
  );
}

/** Watches connectivity and automatically syncs the offline queue when it returns. */
function AutoSync() {
  const online = useOnline();
  const prev = useRef(online);
  useEffect(() => {
    if (online && !prev.current) {
      processQueue().then((n) => n && toast(`${n} item${n > 1 ? 's' : ''} synced`));
    }
    prev.current = online;
  }, [online]);
  // Also flush anything left pending at start-up
  useEffect(() => { if (online) processQueue(); }, []);
  return null;
}

const NAV: { to: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { to: '/app', label: 'Home', icon: 'home', match: (p) => p === '/app' || p.startsWith('/app/admin') },
  { to: '/app/cattle', label: 'Cattle', icon: 'cow', match: (p) => p.startsWith('/app/cattle') || p.startsWith('/app/animal') || p.startsWith('/app/register') },
  { to: '/app/scan', label: 'Scan', icon: 'scan', match: (p) => p.startsWith('/app/scan') },
  { to: '/app/alerts', label: 'Alerts', icon: 'bell', match: (p) => p.startsWith('/app/alerts') || p.startsWith('/app/transfer') || p.startsWith('/app/report') },
  { to: '/app/profile', label: 'Profile', icon: 'user', match: (p) => p.startsWith('/app/profile') },
];

function BottomNav() {
  const { path } = useRoute();
  const { user } = useSession();
  const unread = useDB((d) => d.notifications.filter((n) => n.user_id === user?.id && !n.read).length);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-charcoal-900/10 bg-white/95 backdrop-blur" aria-label="Main">
      <div className="mx-auto grid max-w-screen-sm grid-cols-5 items-end px-2 pt-1.5">
        {NAV.map((n) => {
          const active = n.match(path);
          if (n.icon === 'scan') {
            return (
              <Link key={n.to} to={n.to} className="-mt-7 flex flex-col items-center">
                <span className={cn('grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-white text-white shadow-lg', active ? 'bg-forest-900' : 'bg-forest-700')}>
                  <Icon name="scan" size={30} strokeWidth={2.4} />
                </span>
                <span className="mt-0.5 text-[11px] font-extrabold tracking-wide text-forest-800">SCAN</span>
              </Link>
            );
          }
          return (
            <Link key={n.to} to={n.to} className={cn('relative flex flex-col items-center gap-0.5 rounded-xl py-1.5', active ? 'text-forest-800' : 'text-charcoal-500')}>
              <Icon name={n.icon} size={24} strokeWidth={active ? 2.4 : 2} />
              <span className={cn('text-[11px] uppercase tracking-wide', active ? 'font-extrabold' : 'font-semibold')}>{n.label}</span>
              {n.icon === 'bell' && unread > 0 && <span className="absolute right-[22%] top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { user } = useSession();
  return (
    <div className="min-h-screen pb-28">
      <AutoSync />
      <header className="sticky top-0 z-30 border-b border-charcoal-900/8 bg-white/95 backdrop-blur">
        <div className={cn('mx-auto flex items-center justify-between px-4 py-2.5', wide ? 'max-w-6xl' : 'max-w-screen-sm')}>
          <Link to="/app"><Logo /></Link>
          <div className="flex items-center gap-2">
            {user && user.role !== 'FARMER' && <span className="hidden rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-bold text-sand-700 sm:inline">{ROLE_LABEL[user.role]}</span>}
            <ConnectionIndicator />
          </div>
        </div>
        <OfflineBanner />
      </header>
      <main className={cn('mx-auto px-4 pt-4', wide ? 'max-w-6xl' : 'max-w-screen-sm')}>{children}</main>
      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, subtitle, backTo, action }: { title: string; subtitle?: string; backTo?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {backTo && (
        <button onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.hash = backTo))} className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white ring-1 ring-charcoal-900/10" aria-label="Back">
          <Icon name="arrowLeft" size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-charcoal-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
