import { peso } from "../../lib/format";
import type { CurvePoint } from "../../lib/stats";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const abbr = (monthKey: string) => MONTH_ABBR[Number(monthKey.slice(5, 7)) - 1];
const compact = (n: number) => `₱${Math.round(n / 1000)}k`;

// viewBox geometry (scales to container width)
const W = 320, H = 160, padL = 10, padR = 46, padT = 16, padB = 24;
const innerW = W - padL - padR, innerH = H - padT - padB;

/** Single-series inline-SVG line of interest-bearing debt at each month-end. */
export default function DebtCurveChart({ points }: { points: CurvePoint[] }) {
  return (
    <section className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold text-sm mb-2">Debt over time</h2>
      {points.length === 0 ? (
        <p className="text-xs text-stone-400">Log a payment to see the curve.</p>
      ) : (
        <Plot points={points} />
      )}
    </section>
  );
}

function Plot({ points }: { points: CurvePoint[] }) {
  const n = points.length;
  const maxTop = Math.max(...points.map((p) => p.balance)) * 1.1 || 1;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + (1 - v / maxTop) * innerH;
  const baseY = padT + innerH;

  const line = points.map((p, i) => `${x(i)},${y(p.balance)}`).join(" ");
  const last = points[n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Interest-bearing debt over time">
      {/* zero baseline */}
      <line x1={padL} y1={baseY} x2={padL + innerW} y2={baseY} stroke="#e7e5e4" strokeWidth={1} />
      {/* the series */}
      {n > 1 && <polyline points={line} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <circle key={p.month} cx={x(i)} cy={y(p.balance)} r={3.5} fill="#10b981">
          <title>{`${abbr(p.month)} — ${peso(p.balance)}`}</title>
        </circle>
      ))}
      {/* endpoint value label (selective — only the latest) */}
      <text x={x(n - 1) + 6} y={y(last.balance) + 4} fontSize={11} fill="#57534e" className="tabular-nums">
        {compact(last.balance)}
      </text>
      {/* x labels: first and last month */}
      <text x={padL} y={H - 6} fontSize={10} fill="#a8a29e">{abbr(points[0].month)}</text>
      {n > 1 && (
        <text x={padL + innerW} y={H - 6} fontSize={10} fill="#a8a29e" textAnchor="end">{abbr(last.month)}</text>
      )}
    </svg>
  );
}
