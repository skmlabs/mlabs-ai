import type { CompetitiveComparison } from "@/lib/types/aiInsights";

interface Props {
  comparison: CompetitiveComparison;
}

// Renders the 5-row benchmark table. The business's column (index 1 by
// convention — see prompt: headers = ["Metric", "<Business>", ...]) gets
// a soft indigo wash so the eye anchors there first.
export function CompetitiveTable({ comparison }: Props) {
  const businessColIdx = 1;
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5 overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-white/5">
          <tr>
            {comparison.headers.map((h, i) => (
              <th
                key={i}
                className={`text-xs uppercase tracking-wider text-[#9ca3af] py-2.5 px-3 font-medium ${
                  i === businessColIdx ? "bg-indigo-500/5" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/5 last:border-0">
              <td className="text-xs text-[#9ca3af] py-3 px-3">{row.label}</td>
              {row.values.map((v, ci) => {
                const colIdx = ci + 1; // values[] aligns to headers[1..N]
                return (
                  <td
                    key={ci}
                    className={`text-sm text-white py-3 px-3 ${
                      colIdx === businessColIdx ? "bg-indigo-500/5" : ""
                    }`}
                  >
                    {v || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
