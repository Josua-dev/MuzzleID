// Lightweight SVG charts (no chart library needed — keeps the PWA small for low-bandwidth areas).
export function BarChart({ data, height = 160, color = '#23643f' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2="100" y1={(height / 2) * (1 - g)} y2={(height / 2) * (1 - g)} stroke="#1c1f1d" strokeOpacity=".07" strokeWidth=".3" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 2 - 4);
          return <rect key={d.label} x={i * w + w * 0.18} y={height / 2 - h} width={w * 0.64} height={h} rx="1" fill={color} opacity={i === data.length - 1 ? 1 : 0.75} />;
        })}
      </svg>
      <div className="mt-1 flex">
        {data.map((d) => <div key={d.label} className="flex-1 text-center text-[10px] text-charcoal-500">{d.label}<div className="font-bold text-charcoal-800">{d.value}</div></div>)}
      </div>
    </div>
  );
}

export function HBars({ data, color = '#c8955a' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{d.label}</span><span className="font-bold">{d.value}</span></div>
          <div className="h-2.5 rounded-full bg-surface"><div className="h-2.5 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const R = 40, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f2" strokeWidth="14" />
        {data.map((d) => {
          const len = (d.value / total) * C;
          const el = <circle key={d.label} cx="50" cy="50" r={R} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => <li key={d.label} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />{d.label}<span className="font-bold">{d.value}</span></li>)}
      </ul>
    </div>
  );
}
