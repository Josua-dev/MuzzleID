import { useMemo, useRef, useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, ProtoTag } from '../components/ui/primitives';
import { dbStore } from '../services/store';
import { cn } from '../lib/utils';
import { formatReply, gsmSafe, parseQuery, ussdRoute, ussdWrap, type Channel, type LookupRecord, type ParsedQuery } from '../../supabase/functions/_shared/lookup';

type Msg = { from: 'me' | 'bot'; text: string };

/** Same lookup rules the live SMS / WhatsApp / USSD function uses, run against this device's data. */
function findLocal(q: ParsedQuery): LookupRecord[] {
  if (q.kind !== 'muzzle' && q.kind !== 'tag') return [];
  const d = dbStore.get();
  const hits = d.animals.filter((a) => !a.muzzle_id.startsWith('PENDING') && (q.kind === 'muzzle' ? a.muzzle_id === q.value : a.ear_tag.toUpperCase() === q.value)).slice(0, 3);
  return hits.map((a) => ({
    muzzle_id: a.muzzle_id, ear_tag: a.ear_tag, breed: a.breed, sex: a.sex, region: a.region, status: a.status,
    owner_name: d.ownership.find((o) => o.animal_id === a.id && !o.end_date)?.owner_name,
    registered_at: a.created_at,
    open_report_at: d.theftReports.find((t) => t.animal_id === a.id && t.status === 'OPEN')?.reported_at ?? null,
  }));
}

const CHANNELS: { key: Channel; label: string; hint: string }[] = [
  { key: 'sms', label: 'SMS', hint: 'Any phone. Text to the MuzzleID number.' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Message the MuzzleID WhatsApp number.' },
  { key: 'ussd', label: 'USSD', hint: 'Dial the short code. Works on any phone, no data.' },
];

export function VerifyBySms() {
  const [channel, setChannel] = useState<Channel>('sms');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [path, setPath] = useState<string[] | null>(null); // USSD session
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const samples = useMemo(() => {
    const d = dbStore.get();
    const ok = d.animals.find((a) => a.status === 'ACTIVE' && !a.muzzle_id.startsWith('PENDING'));
    const bad = d.animals.find((a) => (a.status === 'STOLEN' || a.status === 'MISSING') && !a.muzzle_id.startsWith('PENDING'));
    return [ok?.muzzle_id, bad?.muzzle_id, ok ? `TAG ${ok.ear_tag}` : undefined, 'MZ-NA-999999'].filter(Boolean) as string[];
  }, []);

  const switchTo = (c: Channel) => { setChannel(c); setMsgs([]); setPath(null); setInput(''); };

  const send = (raw: string) => {
    const text = raw.trim();
    if (channel === 'ussd') {
      if (!path) return;
      const next = [...path, text];
      const step = ussdRoute(next.join('*'));
      const q = step.query;
      const reply = q ? gsmSafe(formatReply(q, findLocal(q), 'ussd')) : gsmSafe(step.reply ?? '');
      setMsgs((m) => [...m, { from: 'me', text }, { from: 'bot', text: ussdWrap(step.con, reply) }]);
      setPath(step.con ? next : null);
    } else {
      const q = parseQuery(text);
      setMsgs((m) => [...m, { from: 'me', text }, { from: 'bot', text: formatReply(q, findLocal(q), channel) }]);
    }
    setInput('');
  };

  const dial = () => {
    const step = ussdRoute('');
    setMsgs([{ from: 'me', text: '*123#' }, { from: 'bot', text: ussdWrap(step.con, step.reply ?? '') }]);
    setPath(['']);
  };

  const ussdIdle = channel === 'ussd' && !path;
  return (
    <div className="fade-up">
      <PageHeader title="Verify by SMS / WhatsApp / USSD" subtitle="For buyers, auctions and checkpoints without a smartphone" backTo="/app/scan" />
      <p className="mb-3 text-sm text-charcoal-700">
        Anyone can text an animal's MuzzleID and get its register status. This simulator runs the same rules as the live service, on this device's data. <ProtoTag className="align-middle">Simulator: no real message is sent</ProtoTag>
      </p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {CHANNELS.map((c) => (
          <button key={c.key} onClick={() => switchTo(c.key)} className={cn('rounded-xl px-3 py-2 text-sm font-bold ring-1', channel === c.key ? 'bg-charcoal-900 text-white ring-charcoal-900' : 'bg-white text-charcoal-700 ring-charcoal-900/10')}>{c.label}</button>
        ))}
      </div>
      <p className="mb-2 text-xs text-charcoal-500">{CHANNELS.find((c) => c.key === channel)?.hint}</p>

      <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] bg-charcoal-950 p-2 shadow-xl">
        <div className="flex h-[26rem] flex-col rounded-[1.5rem] bg-sand-50">
          <div className="border-b border-charcoal-900/10 px-4 py-2 text-center text-sm font-bold">{channel === 'ussd' ? 'USSD session' : 'MuzzleID'}</div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.length === 0 && <p className="mt-10 text-center text-sm text-charcoal-500">{channel === 'ussd' ? 'Press Dial to start.' : 'Send an ID such as MZ-NA-000238, or tap an example below.'}</p>}
            {msgs.map((m, i) => (
              <div key={i} className={cn('max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm', m.from === 'me' ? 'ml-auto bg-forest-700 text-white' : 'bg-white ring-1 ring-charcoal-900/10', m.from === 'bot' && /^(ALERT|END ALERT)/.test(m.text) && 'bg-red-50 text-red-800 ring-red-300')}>{m.text}</div>
            ))}
            <div ref={end} />
          </div>
          <div className="border-t border-charcoal-900/10 p-2">
            {ussdIdle ? (
              <Button full onClick={dial}>Dial *123#</Button>
            ) : (
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && input.trim() && send(input)} placeholder={channel === 'ussd' ? 'Reply' : 'Type a message'} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-charcoal-900/15" />
                <Button size="md" disabled={!input.trim()} onClick={() => send(input)}>Send</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {channel !== 'ussd' && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {samples.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full bg-white px-3 py-1 font-mono text-xs font-bold ring-1 ring-charcoal-900/15">{s}</button>)}
        </div>
      )}
      <p className="mx-auto mt-4 max-w-sm text-xs text-charcoal-500">A text lookup shows what the register says about the ID someone typed. It cannot prove the animal in front of you is that animal; for that, scan the muzzle in the app.</p>
    </div>
  );
}
