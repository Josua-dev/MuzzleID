import type { AuditLog } from '../types/models';
import { describe, TONE_CLS } from '../lib/activity';
import { Icon } from './ui/Icon';
import { timeAgo } from '../lib/utils';

export function ActivityList({ logs, showActor }: { logs: AuditLog[]; showActor?: boolean }) {
  if (!logs.length) return <p className="rounded-2xl bg-white p-5 text-sm text-charcoal-500 ring-1 ring-charcoal-900/8">No activity yet.</p>;
  return (
    <ul className="divide-y divide-charcoal-900/6 rounded-2xl bg-white ring-1 ring-charcoal-900/8">
      {logs.map((l) => {
        const d = describe(l);
        return (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE_CLS[d.tone]}`}><Icon name={d.icon} size={19} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{d.text}</p>
              <p className="text-xs text-charcoal-500">{timeAgo(l.created_at)}{showActor ? ` · ${l.actor_name}` : ''}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
