'use client';

import { BarChart, Bar, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import type { CalBin, MonthBucket } from '@/lib/site/performance';

const BRAND = 'rgb(var(--s-brand))', ACCENT = 'rgb(var(--s-accent))', LINE = 'rgb(var(--s-line))', MUTED = 'rgb(var(--s-muted))', INK = 'rgb(var(--s-ink))', SURFACE = 'rgb(var(--s-surface))';
const tipStyle = { background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 2, fontSize: 12, color: INK };
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function CalibrationChart({ bins, labels }: { bins: CalBin[]; labels: { predicted: string; observed: string; ideal: string; n: string } }) {
  const data = bins.filter((b) => b.n >= 10).map((b) => ({ x: b.predicted, y: b.observed, n: b.n, range: `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%` }));
  return (
    <div className="h-64 w-full" role="img" aria-label={`${labels.predicted} / ${labels.observed}`}>
      <ResponsiveContainer initialDimension={{ width: 600, height: 256 }}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid stroke={LINE} strokeDasharray="2 4" />
          <XAxis dataKey="x" type="number" domain={[0.3, 1]} ticks={[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]} tickFormatter={pct} stroke={MUTED} fontSize={11} label={{ value: labels.predicted, position: 'insideBottom', offset: -2, fontSize: 11, fill: MUTED }} />
          <YAxis dataKey="y" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pct} stroke={MUTED} fontSize={11} />
          <ReferenceLine segment={[{ x: 0.3, y: 0.3 }, { x: 1, y: 1 }]} stroke={MUTED} strokeDasharray="4 4" ifOverflow="extendDomain" />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(v: any, name: any) => [pct(Number(v)), name === 'y' ? labels.observed : labels.predicted]}
            labelFormatter={(_l: any, payload: any) => (payload?.[0]?.payload ? `${payload[0].payload.range} · ${labels.n} ${payload[0].payload.n}` : '')}
          />
          <Line dataKey="y" stroke={BRAND} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Scatter dataKey="y" fill={BRAND} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ months, labels }: { months: Array<MonthBucket & { label: string }>; labels: { acc: string; n: string } }) {
  const data = months.map((m) => ({ label: m.label, acc: m.acc ?? 0, n: m.n }));
  return (
    <div className="h-56 w-full" role="img" aria-label={labels.acc}>
      <ResponsiveContainer initialDimension={{ width: 600, height: 224 }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }} barCategoryGap="30%">
          <CartesianGrid stroke={LINE} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" stroke={MUTED} fontSize={11} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pct} stroke={MUTED} fontSize={11} />
          <Tooltip contentStyle={tipStyle} cursor={{ fill: LINE, opacity: 0.4 }} formatter={(v: any, _n: any, item: any) => [`${pct(Number(v))} · ${labels.n} ${item?.payload?.n ?? ''}`, labels.acc]} />
          <Bar dataKey="acc" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.n < 30 ? ACCENT : BRAND} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
