import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, Package, ShoppingCart, Truck, AlertTriangle,
  Zap, RefreshCw, CheckCircle, GitCompare, AlertOctagon, XCircle, Cpu, Power, ShieldCheck,
  Sparkles, Check
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—";
const fmtInr = (n) => `₹${fmt(Math.round(n))}`;

function RiskBadge({ level }) {
  const badgeClass =
    level === "urgent" ? "badge-orange" :
    level === "critical" || level === "expired" ? "badge-red" :
    level === "low" ? "badge-lite-green" : "badge-muted";
  return <span className={`badge ${badgeClass}`}>{level}</span>;
}

function FreshnessBarFixed({ hoursLeft, totalWindow = 168 }) {
  const pct = Math.max(0, Math.min(100, (hoursLeft / totalWindow) * 100));
  const color =
    hoursLeft <= 6  ? "var(--risk-critical)"
    : hoursLeft <= 24 ? "var(--risk-urgent)"
    : "var(--lite-green)";
  return (
    <div className="freshness-bar-wrap">
      <div className="freshness-bar">
        <div
          className="freshness-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span style={{ fontSize: 11, color: "var(--dusty-pink)", fontWeight: 500, whiteSpace: "nowrap" }}>
        {hoursLeft.toFixed(1)} h
      </span>
    </div>
  );
}

// ── KPI Card with Structured Haute Palette ─────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accentColor = "var(--dusty-pink)", valueColor = "var(--cream)", badge }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div
          className="kpi-icon"
          style={{
            borderColor: accentColor === "var(--lite-green)" ? "var(--lite-green-border)" : "var(--dusty-pink-border)",
            background: accentColor === "var(--lite-green)" ? "var(--lite-green-dim)" : "rgba(110, 43, 53, 0.3)",
            color: accentColor,
          }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="kpi-value" style={{ color: valueColor }}>{value}</div>
      {sub && (
        <div
          className="kpi-sub"
          style={{ color: accentColor === "var(--lite-green)" ? "var(--lite-green)" : "var(--dusty-pink)" }}
        >
          {sub}
        </div>
      )}
      {badge}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
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
          {p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const toast = useToast();
  const [overview, setOverview]   = useState(null);
  const [atRisk, setAtRisk]       = useState([]);
  const [proposals, setProposals] = useState([]);
  const [orders, setOrders]       = useState([]);
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [cycling, setCycling]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [ov, risk, props, ords, evts] = await Promise.all([
        api.overview(),
        api.atRisk(),
        api.proposals(),
        api.orders(),
        api.agentEvents(20),
      ]);
      setOverview(ov);
      setAtRisk(risk);
      setProposals(props.slice(0, 5));
      setOrders(ords);
      setEvents(evts);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const runCycle = async () => {
    setCycling(true);
    try {
      const r = await api.agentCycle();
      toast(`Agent cycle complete: ${r.match_proposals ?? 0} matches generated`, "success");
      await load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setCycling(false);
    }
  };

  const confirmProposal = async (id) => {
    try {
      await api.confirmOrder(id);
      toast("Match confirmed! Order & cold-chain transport dispatched", "success");
      await load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div className="spinner" style={{ width: 34, height: 34 }} />
    </div>
  );

  const ov = overview;
  const activeOrders  = orders.filter(o => ["confirmed","pickup_scheduled","picked_up","in_transit"].includes(o.status));
  const deliveredOrds = orders.filter(o => o.status === "delivered");

  // Build chart data
  const chartData = [
    { name: "Mon", kg: 320, value: 5760 },
    { name: "Tue", kg: 480, value: 8640 },
    { name: "Wed", kg: 150, value: 2700 },
    { name: "Thu", kg: ov?.food_impact?.kg_moved ?? 240, value: ov?.financials?.gross_transaction_value_inr ?? 4800 },
    { name: "Fri", kg: 600, value: 10800 },
    { name: "Sat", kg: 390, value: 7020 },
    { name: "Sun", kg: 520, value: 9360 },
  ];

  // Agent event type → icon mapping
  const getEventIcon = (type) => {
    switch (type) {
      case "surplus_detected": return <AlertTriangle size={14} style={{ color: "var(--orange)" }} />;
      case "match_found":      return <GitCompare size={14} style={{ color: "var(--lite-green)" }} />;
      case "order_created":    return <CheckCircle size={14} style={{ color: "var(--lite-green)" }} />;
      case "vehicle_assigned": return <Truck size={14} style={{ color: "var(--dusty-pink)" }} />;
      case "order_replanned":  return <RefreshCw size={14} style={{ color: "var(--dusty-pink)" }} />;
      case "vehicle_unavailable": return <AlertOctagon size={14} style={{ color: "var(--red)" }} />;
      case "escalation_required": return <AlertOctagon size={14} style={{ color: "var(--red)" }} />;
      case "order_cancelled":  return <XCircle size={14} style={{ color: "var(--red)" }} />;
      case "cycle_complete":   return <Cpu size={14} style={{ color: "var(--lite-green)" }} />;
      default:                 return <Power size={14} style={{ color: "var(--cream)" }} />;
    }
  };

  return (
    <div className="flex-col gap-6">

      {/* ── Editorial Hero Photographic Card ── */}
      <div className="editorial-hero">
        <div
          className="editorial-hero-bg"
          style={{ backgroundImage: `url('/hero_produce.jpg')` }}
        />
        <div className="editorial-hero-scrim" />
        <div className="editorial-hero-content">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="badge badge-lite-green">MandiPulse Regional Exchange</span>
              <span style={{ fontSize: 11, color: "var(--dusty-pink)", fontWeight: 500 }}>
                Nashik Wholesale Mandi · Western Agro Corridor
              </span>
            </div>
            <h2 className="editorial-hero-title">
              Autonomous Produce Redistribution & Cold-Chain Balancing
            </h2>
            <p className="editorial-hero-sub">
              Bridging farmgate surplus with commercial kitchens & retailers before freshness deteriorates.
              Backed by continuous agentic optimization.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-primary" onClick={runCycle} disabled={cycling}>
              {cycling ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Zap size={14} />}
              {cycling ? "Optimizing…" : "Run Agent Cycle"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Structured Haute KPI Grid ── */}
      <div className="kpi-grid">
        <KpiCard
          label="Gross Value Moved"
          value={fmtInr(ov?.financials?.gross_transaction_value_inr ?? 0)}
          sub="Dispatched transactions"
          icon={TrendingUp}
          accentColor="var(--dusty-pink)"
          valueColor="var(--cream)"
        />
        <KpiCard
          label="Platform Revenue"
          value={fmtInr(ov?.financials?.platform_revenue_inr ?? 0)}
          sub="2% transaction margin"
          icon={ShieldCheck}
          accentColor="var(--dusty-pink)"
          valueColor="var(--cream)"
        />
        <KpiCard
          label="Surplus Rescued"
          value={`${fmt(ov?.food_impact?.kg_moved ?? 0)} kg`}
          sub={`${ov?.food_impact?.surplus_sold_pct ?? 0}% inventory clearance`}
          icon={Package}
          accentColor="var(--lite-green)"
          valueColor="var(--lite-green)"
        />
        <KpiCard
          label="In-Transit Deliveries"
          value={activeOrders.length}
          sub={`${deliveredOrds.length} orders settled`}
          icon={ShoppingCart}
          accentColor="var(--dusty-pink)"
          valueColor="var(--cream)"
        />
        <KpiCard
          label="Batches At-Risk"
          value={atRisk.length}
          sub="Expiring within 24 hours"
          icon={AlertTriangle}
          accentColor="var(--orange)"
          valueColor="var(--cream)"
        />
        <KpiCard
          label="Algorithmic Matches"
          value={proposals.length}
          sub="Ready for cold-chain pairing"
          icon={CheckCircle}
          accentColor="var(--lite-green)"
          valueColor="var(--cream)"
        />
      </div>

      {/* ── Graphs Row: Structured Lite Green & Dusty Pink Visuals ── */}
      <div className="grid-2">
        {/* kg moved area chart */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Produce Volume Rescued (Kg)</h2>
            <span className="badge badge-lite-green">Active Inflow</span>
          </div>
          <div className="card-body">
            <div style={{ height: 220, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liteGreenAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--lite-green)" stopOpacity={0.35} />
                      <stop offset="60%" stopColor="var(--lite-green)" stopOpacity={0.10} />
                      <stop offset="95%" stopColor="var(--lite-green)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="rgba(120, 95, 75, 0.25)" tick={{ fontSize: 11, fill: "var(--text-subtle)" }} />
                  <YAxis stroke="rgba(120, 95, 75, 0.25)" tick={{ fontSize: 11, fill: "var(--text-subtle)" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="kg"
                    name="Volume (kg)"
                    stroke="var(--lite-green)"
                    strokeWidth={2.4}
                    fillOpacity={1}
                    fill="url(#liteGreenAreaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* value bar chart */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Recovered Transaction Value (₹)</h2>
            <span className="badge badge-dusty-pink">Gross Settlement</span>
          </div>
          <div className="card-body">
            <div style={{ height: 220, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="rgba(120, 95, 75, 0.25)" tick={{ fontSize: 11, fill: "var(--text-subtle)" }} />
                  <YAxis stroke="rgba(120, 95, 75, 0.25)" tick={{ fontSize: 11, fill: "var(--text-subtle)" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Value (₹)" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 3 ? "var(--lite-green)" : i % 2 === 0 ? "var(--burgundy)" : "var(--dusty-pink)"}
                        stroke="rgba(120, 95, 75, 0.2)"
                        strokeWidth={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── At-risk inventory + Top proposals ── */}
      <div className="grid-2">
        {/* At-risk */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Critical Shelf-Life Batches</h2>
            <span className="badge badge-orange">{atRisk.length} batches urgent</span>
          </div>
          <div className="table-wrapper">
            {atRisk.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                <p>No inventory currently at risk</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produce</th>
                    <th>Available</th>
                    <th>Freshness Horizon</th>
                    <th>Status</th>
                    <th>Value At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((r, idx) => (
                    <tr key={r.batch_id ?? r.batch?.id ?? idx}>
                      <td style={{ fontWeight: 600, color: "var(--cream)" }}>
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--lite-green)", marginRight: 8 }} />
                        {r.produce_type ?? r.batch?.produce_type ?? "Produce"}
                      </td>
                      <td style={{ color: "var(--cream-soft)" }}>{fmt(r.quantity_available ?? r.batch?.quantity_available)} kg</td>
                      <td>
                        <FreshnessBarFixed hoursLeft={r.hours_remaining} />
                      </td>
                      <td>
                        <RiskBadge level={r.risk_level} />
                      </td>
                      <td style={{ color: "var(--dusty-pink)", fontWeight: 600 }}>
                        {fmtInr(r.value_at_risk)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top proposals */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Algorithmic Match Proposals</h2>
            <span className="badge badge-lite-green">{proposals.length} evaluated</span>
          </div>
          <div className="table-wrapper">
            {proposals.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                <p>No active proposals. Run an agent cycle to discover matches.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Pairing</th>
                    <th>Fitness</th>
                    <th>Gross</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const gross = p.proposed_quantity * p.proposed_price;
                    return (
                      <tr key={p.id}>
                        <td style={{ color: "var(--text-subtle)", fontSize: 12 }}>#{p.id}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--cream)" }}>
                            Batch #{p.batch_id} → Req #{p.demand_id}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--dusty-pink)" }}>
                            {fmt(p.proposed_quantity)} kg @ ₹{p.proposed_price}/kg
                          </div>
                        </td>
                        <td>
                          <span style={{ color: "var(--lite-green)", fontWeight: 700 }}>
                            {(p.score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--cream)" }}>{fmtInr(gross)}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => confirmProposal(p.id)}
                          >
                            Dispatch
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Agent Event Audit Trail ── */}
      <div className="glass-card">
        <div className="card-header">
          <h2>Autonomous Agent Intelligence Telemetry</h2>
          <span className="badge badge-dusty-pink">Live Multi-Agent Stream</span>
        </div>
        <div className="card-body">
          <div className="timeline">
            {events.slice(0, 7).map((ev) => (
              <div key={ev.id} className="timeline-item">
                <div className="timeline-icon">
                  {getEventIcon(ev.event_type)}
                </div>
                <div className="timeline-body">
                  <div className="timeline-header">
                    <span className="timeline-agent" style={{ color: "var(--lite-green)" }}>
                      {ev.agent} agent
                    </span>
                    <span className="timeline-time">
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="timeline-summary">{ev.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
