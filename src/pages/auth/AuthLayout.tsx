import type { ReactNode } from 'react';
import { asset } from '../../lib/assets';
import { Logo } from '../../components/Brand';
import { Link } from '../../lib/router';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface md:grid md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-forest-950 md:block">
        <img src={asset('/demo/nguni.jpg')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <h2 className="text-4xl font-extrabold leading-tight">Every Animal Has an Identity.</h2>
          <p className="mt-2 text-white/75">Livestock digital identity and traceability — built for farms with little or no signal.</p>
        </div>
      </aside>
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <Link to="/"><Logo tagline /></Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-charcoal-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
