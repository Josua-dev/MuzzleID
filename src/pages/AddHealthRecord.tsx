import { useState } from 'react';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Choice, Input, Select, TextArea, toast } from '../components/ui/primitives';
import { AnimalPhoto } from '../components/Brand';
import { useSession } from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { useDB } from '../services/store';
import { addHealthRecord, type HealthInput } from '../services/actions';
import { rules, visibilityFor } from '../lib/permissions';
import { navigate } from '../lib/router';
import type { HealthRecord, HealthState } from '../types/models';

const VACCINES = ['Anthrax & Blackquarter', 'Lumpy Skin Disease', 'Botulism', 'Brucellosis (S19)', 'Pasteurella', 'Lung sickness (CBPP) — where applicable', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

export default function AddHealthRecord({ id }: { id: string }) {
  const { user } = useSession();
  const online = useOnline();
  const a = useDB((d) => d.animals.find((x) => x.id === id));
  const allowed = useDB((d) => (a ? rules(visibilityFor(user!, a, d)).canAddHealth : false));
  const [type, setType] = useState<HealthRecord['type']>('VACCINATION');
  const [f, setF] = useState<HealthInput>({ type: 'VACCINATION', title: VACCINES[0], date: today(), professional_name: user!.full_name, notes: '', medication: '', vaccine_dose: '', next_due: '', condition: undefined });
  const [customVaccine, setCustomVaccine] = useState('');

  if (!a) return null;
  if (!allowed) return <p className="rounded-2xl bg-white p-5">You don't have permission to add health records to this animal.</p>;

  const submit = () => {
    const title = type === 'VACCINATION' ? (f.title === 'Other' ? customVaccine : f.title) : f.title;
    if (!title.trim()) return toast('Add a title', 'warn');
    addHealthRecord(user!, a.id, { ...f, type, title }, online);
    toast(online ? 'Health record saved' : 'Saved on device · pending sync', online ? 'ok' : 'warn');
    navigate(`/app/animal/${a.id}`, true);
  };

  return (
    <div className="fade-up">
      <PageHeader title="Add health record" backTo={`/app/animal/${a.id}`} />
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/8">
        <AnimalPhoto src={a.photo_url} alt="" className="h-14 w-14 rounded-xl" />
        <div><p className="font-mono font-bold">{a.muzzle_id}</p><p className="text-sm text-charcoal-500">{a.breed} · {a.sex} · tag {a.ear_tag}</p></div>
      </div>
      <div className="space-y-4">
        <Choice<HealthRecord['type']> label="Record type" value={type} onChange={(t) => { setType(t); setF({ ...f, title: t === 'VACCINATION' ? VACCINES[0] : '' }); }} options={[
          { value: 'VACCINATION', label: 'Vaccination', icon: 'syringe' }, { value: 'TREATMENT', label: 'Treatment', icon: 'stethoscope' },
          { value: 'EXAMINATION', label: 'Vet examination', icon: 'stethoscope' }, { value: 'TEST_NOTE', label: 'Disease / test', icon: 'file' },
        ]} />
        {type === 'VACCINATION' ? (<>
          <Select label="Vaccine" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} options={VACCINES} />
          {f.title === 'Other' && <Input label="Vaccine name" value={customVaccine} onChange={(e) => setCustomVaccine(e.target.value)} />}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dose" hint="Optional" value={f.vaccine_dose} onChange={(e) => setF({ ...f, vaccine_dose: e.target.value })} placeholder="2 ml SC" />
            <Input label="Next due" hint="Optional" type="date" value={f.next_due} onChange={(e) => setF({ ...f, next_due: e.target.value })} />
          </div>
        </>) : (
          <Input label={type === 'TEST_NOTE' ? 'Disease / test' : type === 'TREATMENT' ? 'Condition treated' : 'Examination'} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        )}
        {type !== 'VACCINATION' && <Input label="Medication" hint="Optional" value={f.medication} onChange={(e) => setF({ ...f, medication: e.target.value })} />}
        <Input label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <Input label="Professional / user name" value={f.professional_name} onChange={(e) => setF({ ...f, professional_name: e.target.value })} />
        <TextArea label="Notes" hint="Optional" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <Choice<HealthState | 'SAME'> label="Animal condition after this record" value={f.condition ?? 'SAME'} onChange={(c) => setF({ ...f, condition: c === 'SAME' ? undefined : c })} cols={2} options={[
          { value: 'SAME', label: 'No change' }, { value: 'HEALTHY', label: 'Healthy' }, { value: 'UNDER_TREATMENT', label: 'Under treatment' }, { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
        ]} />
        <Button full size="xl" icon="check" onClick={submit}>{online ? 'Save record' : 'Save on device'}</Button>
      </div>
    </div>
  );
}
