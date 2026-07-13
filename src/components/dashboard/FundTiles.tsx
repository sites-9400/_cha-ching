import { peso } from "../../lib/format";
import { nextRelease } from "../../lib/stats";
import type { SinkingFund } from "../../lib/types";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** One tile per sinking fund: balance + next release month. */
export default function FundTiles({ funds, monthIndex }: { funds: SinkingFund[]; monthIndex: number }) {
  if (funds.length === 0) return null;
  return (
    <section className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold text-sm mb-3">Sinking funds</h2>
      <div className="grid grid-cols-2 gap-2">
        {funds.map((f) => {
          const rel = nextRelease(f.releaseMonths, monthIndex);
          return (
            <div key={f.id} className="rounded-lg bg-stone-50 p-3">
              <p className="text-xs text-stone-500 truncate">{f.name}</p>
              <p className="text-lg font-bold tabular-nums">{peso(f.balance)}</p>
              <p className="text-[11px] text-stone-400">
                {rel ? `releases ${MONTH_ABBR[rel - 1]}` : "no release set"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
