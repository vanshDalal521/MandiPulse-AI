import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Bot, Leaf, Wallet } from "lucide-react";

const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—";
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

const COLORS = ["#1f7a4d", "#7a2e39", "#c96f28", "#8f4b58", "#5e4f48"];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 10px 28px rgba(120, 95, 75, 0.16)",
      color: "var(--text-primary)",
    }}>
      <div style={{ color: "var(--burgundy)", marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color ?? "var(--lite-green)", fontWeight: 600 }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

function MetricRow({ label, value, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: "1px solid var(--border)"
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: accent ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function Analytics() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [ov, evts] = await Promise.all([api.overview(), api.agentEvents(100)]);
      setOverview(ov);
      setEvents(evts);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex-center" style={{ height: "100%" }}>
      <div className="spinner" style={{ width: 32, height: 32, borderTopColor: "var(--lime)" }} />
    </div>
  );

  const ov = overview;
  const orderPieData = ov ? [
    { name: "Delivered", value: ov.orders.delivered },
    { name: "Active",    value: ov.orders.active },
    { name: "Cancelled", value: ov.orders.cancelled },
    { name: "Review",    value: ov.orders.needs_review },
  ].filter(d => d.value > 0) : [];

  // Event frequency by type
  const evtFreq = events.reduce((acc, ev) => {
    acc[ev.event_type] = (acc[ev.event_type] ?? 0) + 1;
    return acc;
  }, {});
  const evtChartData = Object.entries(evtFreq)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Weekly simulated timeline
  const weekChart = [
    { day: "Mon", surplus: 2, matched: 1, delivered: 1 },
    { day: "Tue", surplus: 4, matched: 3, delivered: 3 },
    { day: "Wed", surplus: 1, matched: 1, delivered: 0 },
    { day: "Thu", surplus: 6, matched: 5, delivered: 4 },
    { day: "Fri", surplus: 3, matched: 3, delivered: 3 },
    { day: "Sat", surplus: 5, matched: 4, delivered: 4 },
    { day: "Sun", surplus: 2, matched: 2, delivered: 2 },
  ];

  return (
    <div className="flex-col" style={{ gap: "var(--sp-5)" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Business & Impact Analytics</h2>
        <p className="text-muted text-sm" style={{ marginTop: 2 }}>
          Transaction metrics, food-loss estimates, and agent activity
        </p>
      </div>

      {/* Financials + Food impact */}
      <div className="grid-2">
        {/* Business metrics */}
        <div className="glass-card">
          <div className="card-header"><h2><Wallet size={16} style={{ color: "var(--dusty-pink)" }} />Business Metrics</h2></div>
          <div className="card-body">
            <MetricRow label="Gross Transaction Value" value={fmtInr(ov?.financials.gross_transaction_value_inr)} accent="var(--lime)" />
            <MetricRow label="Platform Revenue (2%)" value={fmtInr(ov?.financials.platform_revenue_inr)} accent="var(--cyan)" />
            <MetricRow label="Supplier Proceeds" value={fmtInr(ov?.financials.supplier_proceeds_inr)} accent="var(--green)" />
            <MetricRow label="Total Orders" value={ov?.orders.total ?? 0} />
            <MetricRow label="Delivered Orders" value={ov?.orders.delivered ?? 0} accent="var(--green)" />
            <MetricRow label="Cancelled Orders" value={ov?.orders.cancelled ?? 0} accent="var(--red)" />
            <MetricRow label="Needs Review" value={ov?.orders.needs_review ?? 0} accent="var(--orange)" />
          </div>
        </div>

        {/* Food impact */}
        <div className="glass-card">
          <div className="card-header">
            <h2><Leaf size={16} style={{ color: "var(--lite-green)" }} />Food-Loss Impact</h2>
            <span className="badge badge-lime">SDG 2 & 12</span>
          </div>
          <div className="card-body">
            <MetricRow label="Total Kg Moved" value={`${fmt(ov?.food_impact.kg_moved)} kg`} accent="var(--green)" />
            <MetricRow label="Total Kg Listed" value={`${fmt(ov?.food_impact.total_kg_listed)} kg`} />
            <MetricRow label="Surplus Sold %" value={`${ov?.food_impact.surplus_sold_pct ?? 0}%`} accent="var(--lime)" />
            <MetricRow label="At-Risk Batches" value={ov?.inventory.at_risk ?? 0} accent="var(--orange)" />
            <MetricRow label="Available Batches" value={ov?.inventory.available_batches ?? 0} />
            <div style={{
              marginTop: "var(--sp-4)",
              padding: "var(--sp-3)",
              background: "var(--green-dim)",
              border: "1px solid rgba(156,201,168,0.24)",
              borderRadius: "var(--r-sm)",
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}>
              ⚠ These figures represent produce transferred through the platform, not verified food-waste prevented.
              Some produce may have found alternative channels anyway.
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid-2">
        {/* Order status pie */}
        <div className="glass-card">
          <div className="card-header"><h2>Order Status Distribution</h2></div>
          <div className="card-body">
            {orderPieData.length === 0 ? (
              <div className="empty-state"><p>No orders yet</p></div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderPieData} cx="50%" cy="50%" innerRadius={55}
                      outerRadius={90} paddingAngle={3} dataKey="value">
                      {orderPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(value) => (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Weekly ops area chart */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Weekly Operations</h2>
            <span className="badge badge-muted">Simulated</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekChart}>
                  <defs>
                    <linearGradient id="surpG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--dusty-pink)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--dusty-pink)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="delG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--lite-green)" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="var(--lite-green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="surplus" name="Surplus (kg)" stroke="var(--dusty-pink)"
                    fill="url(#surpG)" strokeWidth={2.2} />
                  <Area type="monotone" dataKey="delivered" name="Delivered (kg)" stroke="var(--lite-green)"
                    fill="url(#delG)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Agent activity frequency */}
      <div className="glass-card">
        <div className="card-header">
          <h2><Bot size={16} style={{ color: "var(--dusty-pink)" }} />Agent Activity Breakdown</h2>
          <span className="badge badge-muted">{events.length} events logged</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Event Type</th><th>Count</th><th>Frequency</th></tr>
            </thead>
            <tbody>
              {evtChartData.map((row, i) => {
                const pct = Math.round(100 * row.value / Math.max(events.length, 1));
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.value}</td>
                    <td style={{ minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "rgba(248,241,228,0.1)", borderRadius: 99 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {evtChartData.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  Run an agent cycle to see activity
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
