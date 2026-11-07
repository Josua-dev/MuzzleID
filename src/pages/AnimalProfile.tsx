import { useRef, useState, type ChangeEvent } from 'react';
import { asset } from '../lib/assets';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, EmptyState, HEALTH_META, KV, ProtoTag, Sheet, StatusBadge, toast } from '../components/ui/primitives';
import { Icon, type IconName } from '../components/ui/Icon';
import { AnimalPhoto, MuzzlePattern } from '../components/Brand';
import { IdentityCard } from '../components/IdentityCard';
import { Timeline } from '../components/Timeline';
import { ContactOwnerSheet } from '../components/ContactOwnerSheet';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useDB } from '../services/store';
import { currentOwnership, displayStatus, openReport, ownershipHistory, pendingTransfer } from '../services/queries';
import { acceptTransfer, addDocument, closeTransfer, markRecovered } from '../services/actions';
import { rules, TRACE_EVENTS, visibilityFor, ROLE_LABEL } from '../lib/permissions';
import { birthYear, cn, fmtDate, maskName, maskPhone } from '../lib/utils';
import { navigate } from '../lib/router';
import type { AnimalDocument, HealthRecord } from '../types/models';

type Tab = 'identity' | 'ownership' | 'health' | 'history' | 'documents';

const H_ICON: Record<HealthRecord['type'], { icon: IconName; label: string; cls: string }> = {
  VACCINATION: { icon: 'syringe', label: 'Vaccination', cls: 'bg-forest-100 text-forest-800' },
  TREATMENT: { icon: 'stethoscope', label: 'Treatment', cls: 'bg-amber-100 text-amber-800' },
  EXAMINATION: { icon: 'stethoscope', label: 'Examination', cls: 'bg-blue-100 text-blue-800' },
  TEST_NOTE: { icon: 'file', label: 'Disease / test note', cls: 'bg-sand-100 text-sand-700' },
};

export default function AnimalProfile({ id }: { id: string }) {
  const { user } = useSession();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('identity');
  const [card, setCard] = useState(false);
  const [contact, setContact] = useState(false);
  const [docKind, setDocKind] = useState<AnimalDocument['kind']>('VETERINARY');
  const fileRef = useRef<HTMLInputElement>(null);

  const v = useDB((d) => {
    const a = d.animals.find((x) => x.id === id);
    if (!a) return null;
    const vis = visibilityFor(user!, a, d);
    const health = d.health.filter((h) => h.animal_id === id).sort((x, y) => y.date.localeCompare(x.date));
    return {
      a, vis, r: rules(vis), status: displayStatus(d, a, user), own: currentOwnership(d, id), history: ownershipHistory(d, id),
      report: openReport(d, id), transfer: pendingTransfer(d, id), health,
      vacc: d.vaccinations, movements: d.movements.filter((m) => m.animal_id === id),
      docs: d.documents.filter((x) => x.animal_id === id), bio: d.biometrics.find((b) => b.animal_id === id),
      pendingSync: d.syncQueue.filter((q) => q.status !== 'SYNCED' && (q.entity_id === id || JSON.stringify(q.payload).includes(id))).length,
    };
  });

  if (!v) return <EmptyState icon="search" title="Record not found" action={<Button size="md" onClick={() => navigate('/app/cattle')}>Back to livestock</Button>} />;
  const { a, r, status, own, report, transfer } = v;
  const isOwner = a.owner_id === user!.id;
  const ownerName = own ? (r.ownerFullName ? own.owner_name : maskName(own.owner_name)) : '—';
  const alert = a.status === 'STOLEN' || a.status === 'MISSING';

  const tabs: { k: Tab; label: string; show: boolean }[] = [
    { k: 'identity', label: 'Identity', show: true },
    { k: 'ownership', label: 'Ownership', show: true },
    { k: 'health', label: 'Health', show: r.healthSummary },
    { k: 'history', label: 'History', show: r.fullTimeline || r.traceTimeline },
    { k: 'documents', label: 'Documents', show: r.documents },
  ];

  const onDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    addDocument(user!, a.id, docKind, { name: f.name, size: f.size }, online);
    toast('Document added');
  };

  const lastVacc = v.health.find((h) => h.type === 'VACCINATION');

  return (
    <div className="fade-up">
      <PageHeader title="Livestock passport" subtitle={a.is_demo ? 'Demo record' : undefined} backTo="/app/cattle"
        action={<button onClick={() => setCard(true)} className="grid h-11 w-11 place-items-center rounded-full bg-forest-800 text-white" aria-label="Show identity card"><Icon name="fingerprint" size={20} /></button>} />

      {/* Hero */}
      <div className={cn('overflow-hidden rounded-3xl bg-white ring-1', alert ? 'ring-2 ring-red-400' : 'ring-charcoal-900/8')}>
        <div className="relative">
          <AnimalPhoto src={a.photo_url} alt={a.breed} className="h-56 w-full sm:h-72" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal-950/85 to-transparent p-4 pt-12 text-white">
            <p className="font-mono text-2xl font-bold tracking-tight">{a.muzzle_id}</p>
            <p className="text-sm text-white/85">{a.name ? `${a.name} · ` : ''}{a.breed} · {a.sex} · {a.colour}</p>
          </div>
          <div className="absolute right-3 top-3"><StatusBadge status={status} size="lg" /></div>
        </div>
        {alert && (
          <div className="bg-red-600 px-4 py-3 text-white">
            <p className="flex items-center gap-2 font-extrabold uppercase tracking-wide"><Icon name="alert" size={18} /> Reported {a.status.toLowerCase()} · {fmtDate(report?.reported_at)}</p>
            {report && <p className="mt-0.5 text-sm text-white/90">Last seen: {report.last_seen_location}</p>}
          </div>
        )}
        {(a.sync_state === 'PENDING' || v.pendingSync > 0) && (
          <div className="flex items-center gap-2 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-sand-700"><Icon name="device" size={16} /> Stored on this device · pending sync</div>
        )}
        <div className="grid grid-cols-3 divide-x divide-charcoal-900/8 border-t border-charcoal-900/8 text-center">
          <div className="p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-500">Ear tag</p><p className="truncate text-sm font-bold">{a.ear_tag}</p></div>
          <div className="p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-500">Born</p><p className="text-sm font-bold">{birthYear(a.birth_date)}</p></div>
          <div className="p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-500">Health</p><p className={cn('text-sm font-bold', HEALTH_META[a.health_status].cls)}>{r.healthSummary ? HEALTH_META[a.health_status].label : '—'}</p></div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {r.canAddHealth && <Button variant="secondary" icon="syringe" onClick={() => navigate(`/app/animal/${a.id}/health`)}>Add health</Button>}
        {r.canManage && !alert && a.status !== 'TRANSFER_PENDING' && status !== 'PENDING_SYNC' && <Button variant="secondary" icon="transfer" onClick={() => navigate(`/app/transfer?animal=${a.id}`)}>Transfer</Button>}
        {r.canManage && !alert && <Button variant="outline" icon="alert" className="!text-red-700" onClick={() => navigate(`/app/report?animal=${a.id}`)}>Report missing</Button>}
        {r.canManage && alert && <Button size="md" className="h-13" icon="checkCircle" onClick={() => { markRecovered(user!, a.id, 'Animal recovered and returned to herd', online); toast('Marked as recovered'); }}>Mark recovered</Button>}
        {!isOwner && <Button variant="outline" icon="message" onClick={() => setContact(true)}>Contact owner</Button>}
      </div>

      {/* Tabs */}
      <div className="sticky top-[57px] z-20 -mx-4 mt-5 bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-charcoal-900/8">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={cn('h-10 shrink-0 flex-1 rounded-xl px-3 text-sm font-bold', tab === t.k ? 'bg-forest-800 text-white' : 'text-charcoal-500')}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {tab === 'identity' && (
          <div className="space-y-3">
            <Card className="px-4 py-1">
              <KV k="MuzzleID" v={a.muzzle_id} mono />
              <KV k="Ear tag" v={a.ear_tag} mono />
              <KV k="Breed" v={a.breed} />
              <KV k="Sex" v={a.sex} />
              <KV k="Colour" v={a.colour} />
              <KV k="Birth year" v={birthYear(a.birth_date)} />
              <KV k="Registration date" v={fmtDate(a.created_at)} />
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="font-bold">Muzzle biometric record</p><ProtoTag /></div>
              <div className="mt-3 flex gap-3">
                {(r.documents && v.bio?.reference_image) ? <img src={asset(v.bio.reference_image)} alt="Muzzle reference" className="h-20 w-20 rounded-xl object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-surface"><Icon name="lock" className="text-charcoal-400" /></div>}
                <div className="flex-1 text-sm">
                  <MuzzlePattern seed={a.muzzle_id} className="mb-1 h-8 w-11" />
                  <p className="text-charcoal-500">Model: <b className="text-charcoal-800">{v.bio?.model_version}</b></p>
                  <p className="text-charcoal-500">Enrolment quality: <b className="text-charcoal-800">{v.bio?.enrollment_quality ? `${Math.round(v.bio.enrollment_quality * 100)}%` : 'Pending sync'}</b></p>
                </div>
              </div>
              <p className="mt-2 text-xs text-charcoal-500">Prototype uses a simulated matcher. Reference image visible to owner, veterinary and admin users only.</p>
            </Card>
          </div>
        )}

        {tab === 'ownership' && (
          <div className="space-y-3">
            <Card className="px-4 py-1">
              <KV k="Current owner" v={ownerName} />
              {r.ownerPhone && own && <KV k="Phone" v={own.owner_phone} />}
              {!r.ownerPhone && own && <KV k="Phone" v={<span className="inline-flex items-center gap-1 text-charcoal-500"><Icon name="lock" size={13} />{maskPhone(own.owner_phone)}</span>} />}
              <KV k="Farm" v={r.farm ? own?.farm ?? a.farm : 'Hidden'} />
              <KV k="Region" v={own?.region ?? a.region} />
              <KV k="Ownership start date" v={fmtDate(own?.start_date)} />
            </Card>
            {transfer && (
              <Card className="border-blue-300 bg-blue-50 p-4">
                <p className="flex items-center gap-2 font-bold text-blue-900"><Icon name="transfer" size={18} /> Transfer pending</p>
                <p className="mt-1 text-sm text-blue-900">To {transfer.buyer_name} · requested {fmtDate(transfer.created_at)}</p>
                {transfer.buyer_user_id === user!.id && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="md" variant="outline" onClick={() => closeTransfer(user!, transfer.id, 'DECLINED', online)}>Decline</Button>
                    <Button size="md" icon="check" onClick={() => { acceptTransfer(user!, transfer.id, online); toast('Transfer complete'); }}>Accept</Button>
                  </div>
                )}
                {transfer.seller_id === user!.id && <Button size="md" variant="ghost" className="mt-2" onClick={() => navigate('/app/transfer')}>Manage transfer</Button>}
              </Card>
            )}
            {r.ownershipHistory && (
              <Card className="p-4">
                <p className="mb-3 font-bold">Ownership history</p>
                <ol className="space-y-3">
                  {v.history.map((o) => (
                    <li key={o.id} className="flex gap-3">
                      <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', o.end_date ? 'bg-charcoal-400' : 'bg-forest-600')} />
                      <div className="text-sm">
                        <p className="font-bold">{o.owner_name}{!o.end_date && <span className="ml-2 rounded-full bg-forest-100 px-2 py-0.5 text-[11px] text-forest-800">Current</span>}</p>
                        <p className="text-charcoal-500">{o.farm}, {o.region}</p>
                        <p className="text-xs text-charcoal-500">{fmtDate(o.start_date)} to {o.end_date ? fmtDate(o.end_date) : 'present'}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        )}

        {tab === 'health' && (
          r.healthDetail ? (
            <div className="space-y-3">
              {r.canAddHealth && <Button full variant="secondary" icon="plus" onClick={() => navigate(`/app/animal/${a.id}/health`)}>Add health record</Button>}
              {v.health.length ? v.health.map((h) => {
                const m = H_ICON[h.type];
                const vac = v.vacc.find((x) => x.health_record_id === h.id);
                return (
                  <Card key={h.id} className="p-4">
                    <div className="flex gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.cls}`}><Icon name={m.icon} size={19} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-500">{m.label} · {fmtDate(h.date)}</p>
                        <p className="font-bold">{h.title}</p>
                        {h.medication && <p className="text-sm text-charcoal-700">Medication: {h.medication}</p>}
                        {vac && <p className="text-sm text-charcoal-700">{vac.dose ? `Dose ${vac.dose}` : ''}{vac.next_due ? ` · Next due ${fmtDate(vac.next_due)}` : ''}</p>}
                        {h.notes && <p className="mt-1 text-sm text-charcoal-500">{h.notes}</p>}
                        <p className="mt-1 text-xs text-charcoal-500">{h.recorded_by_name} · {ROLE_LABEL[h.recorded_by_role]}</p>
                      </div>
                    </div>
                  </Card>
                );
              }) : <EmptyState icon="syringe" title="No health records yet" />}
            </div>
          ) : (
            <Card className="px-4 py-1">
              <KV k="Health status" v={HEALTH_META[a.health_status].label} />
              <KV k="Health records on file" v={v.health.length} />
              <KV k="Last vaccination" v={lastVacc ? `${lastVacc.title} · ${fmtDate(lastVacc.date)}` : '—'} />
              <p className="py-3 text-xs text-charcoal-500"><Icon name="lock" size={12} className="inline" /> Detailed health history is visible to the owner and veterinary users.</p>
            </Card>
          )
        )}

        {tab === 'history' && (
          <Card className="p-4">
            {r.traceTimeline && <p className="mb-3 text-xs text-charcoal-500">Selected traceability events shown for verification.</p>}
            <Timeline items={r.fullTimeline ? v.movements : v.movements.filter((m) => TRACE_EVENTS.includes(m.event))} />
          </Card>
        )}

        {tab === 'documents' && (
          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="font-bold">Upload document</p><ProtoTag>Prototype upload</ProtoTag></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([['VETERINARY', 'Veterinary'], ['OWNERSHIP', 'Ownership'], ['VACCINATION', 'Vaccination']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => { setDocKind(k); fileRef.current?.click(); }} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-charcoal-900/12 text-xs font-bold hover:border-forest-600">
                    <Icon name="upload" size={20} className="text-forest-700" />{l}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-charcoal-500">Prototype stores file name and size as a record. File storage uses Supabase Storage when connected.</p>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onDoc} />
            </Card>
            {v.docs.length ? v.docs.map((d) => (
              <Card key={d.id} className="flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand-100 text-sand-700"><Icon name="file" size={19} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{d.file_name}</p><p className="text-xs text-charcoal-500">{d.kind.charAt(0) + d.kind.slice(1).toLowerCase()} · {d.size_kb} KB · {d.uploaded_by_name} · {fmtDate(d.uploaded_at)}</p></div>
              </Card>
            )) : <EmptyState icon="file" title="No documents yet" />}
          </div>
        )}
      </div>

      <Sheet open={card} onClose={() => setCard(false)} title="Digital identity card">
        <IdentityCard animal={a} ownerName={ownerName} verified={a.status === 'ACTIVE'} />
        {a.status !== 'ACTIVE' && <div className="mt-3 flex justify-center"><StatusBadge status={status} size="lg" /></div>}
      </Sheet>
      {!isOwner && <ContactOwnerSheet open={contact} onClose={() => setContact(false)} animal={a} user={user!} />}
    </div>
  );
}
