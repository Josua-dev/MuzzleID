import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Icon, type IconName } from './Icon';
import type { DisplayStatus, HealthState } from '../../types/models';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'sand';
const V: Record<Variant, string> = {
  primary: 'bg-forest-800 text-white hover:bg-forest-700 active:bg-forest-900 disabled:bg-charcoal-400',
  secondary: 'bg-forest-100 text-forest-900 hover:bg-forest-200',
  outline: 'border-2 border-charcoal-900/15 bg-white text-charcoal-900 hover:border-forest-700',
  ghost: 'text-forest-800 hover:bg-forest-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  sand: 'bg-sand-500 text-charcoal-950 hover:bg-sand-400',
};

export function Button({ variant = 'primary', size = 'lg', icon, iconRight, full, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'xl'; icon?: IconName; iconRight?: IconName; full?: boolean }) {
  const sz = size === 'xl' ? 'h-16 px-6 text-lg' : size === 'lg' ? 'h-13 px-4 text-[15px] min-h-[52px]' : 'h-10 px-3.5 text-sm';
  return (
    <button {...rest} className={cn('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60', V[variant], sz, full && 'w-full', className)}>
      {icon && <Icon name={icon} size={size === 'md' ? 18 : 22} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'md' ? 18 : 20} />}
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return <div onClick={onClick} className={cn('rounded-2xl border border-charcoal-900/8 bg-white shadow-[0_1px_2px_rgba(20,23,21,.04)]', onClick && 'cursor-pointer hover:border-forest-600/40', className)}>{children}</div>;
}

export const STATUS_META: Record<DisplayStatus, { label: string; cls: string; dot: string }> = {
  ACTIVE: { label: 'Active', cls: 'bg-forest-100 text-forest-800 ring-forest-600/25', dot: 'bg-forest-600' },
  MISSING: { label: 'Missing', cls: 'bg-amber-100 text-amber-900 ring-amber-500/40', dot: 'bg-amber-500' },
  STOLEN: { label: 'Stolen', cls: 'bg-red-100 text-red-800 ring-red-600/30', dot: 'bg-red-600' },
  TRANSFER_PENDING: { label: 'Transfer pending', cls: 'bg-blue-100 text-blue-800 ring-blue-600/25', dot: 'bg-blue-600' },
  TRANSFERRED: { label: 'Transferred', cls: 'bg-charcoal-900/8 text-charcoal-700 ring-charcoal-900/15', dot: 'bg-charcoal-500' },
  PENDING_SYNC: { label: 'Pending sync', cls: 'bg-sand-100 text-sand-700 ring-sand-500/40', dot: 'bg-sand-500' },
};

export function StatusBadge({ status, size = 'md' }: { status: DisplayStatus; size?: 'md' | 'lg' }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ring-1', m.cls, size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-[11px]')}>
      <span className={cn('h-2 w-2 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export const HEALTH_META: Record<HealthState, { label: string; cls: string }> = {
  HEALTHY: { label: 'Healthy', cls: 'text-forest-700' },
  UNDER_TREATMENT: { label: 'Under treatment', cls: 'text-amber-700' },
  NEEDS_ATTENTION: { label: 'Needs attention', cls: 'text-red-700' },
};

/** Clear marker for simulated / prototype functionality. */
export function ProtoTag({ children = 'Simulated', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-sand-600/60 bg-sand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sand-700', className)}>
      <Icon name="layers" size={11} /> {children}
    </span>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-charcoal-800">
      {children}
      {hint && <span className="text-xs font-normal text-charcoal-500">{hint}</span>}
    </span>
  );
}

const fieldCls = 'w-full rounded-xl border-2 border-charcoal-900/12 bg-white px-4 text-base text-charcoal-900 placeholder:text-charcoal-400 focus:border-forest-600 focus:outline-none';

export function Input({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      <input {...rest} className={cn(fieldCls, 'h-13 min-h-[52px]')} />
    </label>
  );
}

export function Select({ label, hint, options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; options: (string | { value: string; label: string })[] }) {
  return (
    <label className={cn('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      <select {...rest} className={cn(fieldCls, 'h-13 min-h-[52px] appearance-none bg-[length:20px] bg-[right_14px_center] bg-no-repeat pr-10')}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233a3f3c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
        {options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function TextArea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      <textarea {...rest} className={cn(fieldCls, 'min-h-[96px] py-3')} />
    </label>
  );
}

/** Large tap-friendly choice chips (minimal typing). */
export function Choice<T extends string>({ label, value, options, onChange, cols = 2 }: { label?: string; value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button type="button" key={o.value} onClick={() => onChange(o.value)}
            className={cn('flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors',
              value === o.value ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-charcoal-900/12 bg-white text-charcoal-700')}>
            {o.icon && <Icon name={o.icon} size={18} />} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="fade-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Close"><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-charcoal-900/10 bg-white px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-forest-50 text-forest-700"><Icon name={icon} size={26} /></div>
      <p className="font-bold">{title}</p>
      {body && <p className="mt-1 text-sm text-charcoal-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal-500">{children}</h2>
      {action}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-charcoal-900/6 py-2.5 last:border-0">
      <span className="text-sm text-charcoal-500">{k}</span>
      <span className={cn('text-right text-sm font-semibold text-charcoal-900', mono && 'font-mono tracking-tight')}>{v}</span>
    </div>
  );
}

// ---- toast ----
type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'err' };
let push: ((t: Toast) => void) | null = null;
export const toast = (text: string, tone: Toast['tone'] = 'ok') => push?.({ id: Date.now() + Math.random(), text, tone });

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => { setItems((s) => [...s, t]); setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 2600); };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className={cn('fade-up pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg',
          t.tone === 'ok' ? 'bg-forest-800 text-white' : t.tone === 'warn' ? 'bg-sand-500 text-charcoal-950' : 'bg-red-600 text-white')}>
          <Icon name={t.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} /> {t.text}
        </div>
      ))}
    </div>
  );
}
