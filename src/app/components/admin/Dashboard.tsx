import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import type { UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";

/** Admin usage dashboard: most-used templates (downloads primary, opens
 * secondary), per-template table, total exports. Events are recorded inside
 * SchemaRenderer. */
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
    return <p className="text-center py-24" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading usage…</p>;
  }

  const chartData = summary.rows.slice(0, 10).map((r) => ({
    name: r.templateName.length > 18 ? `${r.templateName.slice(0, 17)}…` : r.templateName,
    Downloads: r.downloads,
    Opens: r.opens,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="sp-page-title">Usage</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Which templates your team actually uses.
          </p>
        </div>
        <div className="sp-card flex items-center gap-3 px-4 py-3">
          <span
            className="flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: "var(--radius-icon)", background: "var(--sand)" }}
          >
            <Download style={{ width: 15, height: 15, color: "var(--ink)" }} />
          </span>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 24, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1 }}>
              {summary.totalDownloads}
            </p>
            <p className="sp-eyebrow" style={{ marginTop: 3 }}>Total exports</p>
          </div>
        </div>
      </div>

      {summary.rows.length === 0 ? (
        <p
          className="text-center py-20"
          style={{ fontSize: 13, color: "var(--fg-2)", border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-card)" }}
        >
          No usage yet — events appear as soon as members open and download templates.
        </p>
      ) : (
        <>
          <div className="sp-card p-5 mb-5">
            <h2 className="sp-panel-title mb-4">Most-used templates</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontFamily: "var(--font-ui)" }}
                    interval={0}
                    angle={-14}
                    height={50}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: "var(--font-ui)" }} />
                  <Tooltip contentStyle={{ fontFamily: "var(--font-ui)", fontSize: 12, borderRadius: 8, border: "1px solid var(--hairline)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-ui)" }} />
                  <Bar dataKey="Downloads" fill="var(--solar)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Opens" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sp-card overflow-hidden overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["Template", "Opens", "Downloads", "Last used"].map((h) => (
                    <th key={h} className="sp-eyebrow px-4 py-2.5" style={{ fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.templateId} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)", fontWeight: 500 }}>{r.templateName}</td>
                    <td className="px-4 py-2.5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)" }}>{r.opens}</td>
                    <td className="px-4 py-2.5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{r.downloads}</td>
                    <td className="px-4 py-2.5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>
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
