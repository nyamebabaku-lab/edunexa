// Shared chart styling. Palette validated for CVD separation and contrast in both themes.
import { useDB, useSession } from '../data/store';
import { themePalettes } from '../lib/theme';

// The default blue/red pair is validated for colour-blind separation; custom school colours follow the theme.
export function useChartTheme() {
  const dark = useSession((s) => s.dark);
  const theme = useDB((s) => s.settings.theme);
  const { brand, accent } = themePalettes(theme);
  return dark
    ? { primary: brand[500], secondary: accent[500], grid: 'rgba(255,255,255,.06)', axis: '#64748b', surface: '#0a1330', soft: `${brand[500]}2e` }
    : { primary: brand[600], secondary: accent[600], grid: '#eef2f7', axis: '#94a3b8', surface: '#ffffff', soft: `${brand[600]}1f` };
}

export const axisProps = (t) => ({
  stroke: t.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
});

export function ChartTooltip({ active, payload, label, format = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs shadow-lift dark:border-white/10 dark:bg-navy-800">
      <p className="mb-1 font-semibold text-slate-800 dark:text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-slate-900 dark:text-white">{format(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
