import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import type { UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";

/** Admin usage dashboard: most-used templates (downloads primary, opens
 * secondary), per-template table, total exports. Data via
 * UsageStore.getUsageSummary — events are recorded inside SchemaRenderer. */
export function Dashboard() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    if (!company) return;
    stores.usage
      .getUsageSummary(company.id)
      .then(setSummary)
      .catch((e) => console.error("Usage summary failed", e));
  }, [company]);

  if (!summary) {
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading usage…</p>;
  }

  const chartData = summary.rows.slice(0, 10).map((r) => ({
    name: r.templateName.length > 18 ? `${r.templateName.slice(0, 17)}…` : r.templateName,
    Downloads: r.downloads,
    Opens: r.opens,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-extrabold uppercase text-xl" style={{ color: "var(--foreground)" }}>Usage</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Which templates your team actually uses.
          </p>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-3"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Download className="w-5 h-5" />
          <div>
            <p className="font-extrabold text-xl leading-none">{summary.totalDownloads}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-0.5">Total exports</p>
          </div>
        </div>
      </div>

      {summary.rows.length === 0 ? (
        <p className="text-center py-20 text-sm rounded-3xl border-2 border-dashed" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          No usage yet — events appear as soon as members open and download templates.
        </p>
      ) : (
        <>
          <div className="bg-white rounded-2xl border p-6 mb-6" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-extrabold uppercase text-sm mb-4" style={{ color: "var(--foreground)" }}>
              Most-used templates
            </h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-14} height={50} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Downloads" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Opens" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--secondary)" }}>
                  {["Template", "Opens", "Downloads", "Last used"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--secondary-foreground)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.templateId} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-semibold" style={{ color: "var(--foreground)" }}>{r.templateName}</td>
                    <td className="px-5 py-3" style={{ color: "var(--muted-foreground)" }}>{r.opens}</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: "var(--foreground)" }}>{r.downloads}</td>
                    <td className="px-5 py-3" style={{ color: "var(--muted-foreground)" }}>
                      {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
