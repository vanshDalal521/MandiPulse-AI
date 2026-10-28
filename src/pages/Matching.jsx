import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { parseApiDate } from "../utils/date";
import { Plus, X, CheckCircle, RefreshCw, ClipboardList } from "lucide-react";

const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—";
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

function ScoreBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 60 ? "var(--lite-green)" : pct >= 35 ? "var(--dusty-pink)" : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(248,241,228,0.1)", borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}</span>
    </div>
  );
}

export default function Matching() {
  const toast = useToast();
  const [proposals, setProposals] = useState([]);
  const [demands, setDemands]     = useState([]);
  const [batches, setBatches]     = useState([]);
  const [buyers, setBuyers]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    buyer_id: "", produce_type: "", quantity_required: "",
    maximum_price: "", quality_requirement: "A,B",
    delivery_deadline: "", delivery_location: "",
  });

  const load = useCallback(async () => {
    try {
      const [props, dems, inv, buys] = await Promise.all([
        api.proposals(), api.demands(), api.inventory(), api.buyers()
      ]);
      setProposals(props);
      setDemands(dems);
      setBatches(inv);
      setBuyers(buys);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (proposalId) => {
    setConfirming(proposalId);
    try {
      const order = await api.confirmOrder(proposalId);
      toast(`Order #${order.id} confirmed! Vehicle assigned.`, "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setConfirming(null);
    }
  };

  const refresh = async () => {
    try {
      const r = await api.refreshProposals();
      toast(`${r.proposals_generated} new proposals generated`, "info");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const createDemand = async (e) => {
    e.preventDefault();
    try {
      await api.createDemand({
        ...form,
        buyer_id: Number(form.buyer_id),
        quantity_required: Number(form.quantity_required),
        maximum_price: Number(form.maximum_price),
      });
      toast("Demand request posted!", "success");
      setShowModal(false);
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (loading) return (
    <div className="flex-center" style={{ height: "100%" }}>
      <div className="spinner" style={{ width: 32, height: 32, borderTopColor: "var(--lime)" }} />
    </div>
  );

  return (
    <div className="flex-col" style={{ gap: "var(--sp-5)" }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Supply-Demand Matching</h2>
          <p className="text-muted text-sm" style={{ marginTop: 2 }}>
            AI-generated ranked proposals based on freshness, price, quality & logistics
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={refresh}>
            <RefreshCw size={14} /> Refresh Proposals
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Post Demand
          </button>
        </div>
      </div>

      {/* Proposals */}
      <div className="glass-card">
        <div className="card-header">
          <h2>Match Proposals</h2>
          <span className="badge badge-pink">{proposals.length} evaluated</span>
        </div>
        <div className="table-wrapper">
          {proposals.length === 0 ? (
            <div className="empty-state">
              <RefreshCw size={32} />
              <p>No pending proposals – click "Refresh Proposals" to run the matching engine</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Batch</th><th>Produce</th><th>Demand</th>
                  <th>Qty (kg)</th><th>Price/kg</th>
                  <th>Transport</th><th>Fee</th><th>Supplier Proceeds</th>
                  <th>Score</th><th></th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const batch = batches.find((b) => b.id === p.batch_id);
                  return (
                    <tr key={p.id}>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{p.batch_id}</td>
                      <td style={{ fontWeight: 600 }}>{batch?.produce_type ?? "—"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{p.demand_id}</td>
                      <td>{fmt(p.proposed_quantity)}</td>
                      <td>{fmtInr(p.proposed_price)}</td>
                      <td style={{ color: "var(--orange)" }}>{fmtInr(p.estimated_transport_cost)}</td>
                      <td style={{ color: "var(--cyan)" }}>{fmtInr(p.platform_fee)}</td>
                      <td style={{ color: p.supplier_proceeds < 0 ? "var(--red)" : "var(--lime)", fontWeight: 600 }}>{fmtInr(p.supplier_proceeds)}</td>
                      <td style={{ minWidth: 100 }}><ScoreBar score={p.score} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => confirm(p.id)}
                          disabled={confirming === p.id}
                        >
                          {confirming === p.id ? <span className="spinner" /> : <CheckCircle size={13} />}
                          {confirming === p.id ? "…" : "Confirm"}
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

      {/* Open Demands */}
      <div className="glass-card">
        <div className="card-header">
          <h2><ClipboardList size={16} style={{ color: "var(--dusty-pink)" }} />Open Demand Requests</h2>
          <span className="badge badge-violet">{demands.length} open</span>
        </div>
        <div className="table-wrapper">
          {demands.length === 0 ? (
            <div className="empty-state"><p>No open demand requests</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Buyer</th><th>Produce</th>
                  <th>Required</th><th>Fulfilled</th><th>Max Price</th>
                  <th>Quality</th><th>Deadline</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {demands.map((d) => {
                  const buyer = buyers.find((b) => b.id === d.buyer_id);
                  const ddl = parseApiDate(d.delivery_deadline);
                  const isUrgent = ddl ? ddl - Date.now() < 24 * 36e5 : false;
                  return (
                    <tr key={d.id}>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{d.id}</td>
                      <td style={{ fontWeight: 600 }}>{buyer?.name ?? `Buyer #${d.buyer_id}`}</td>
                      <td>{d.produce_type}</td>
                      <td>{fmt(d.quantity_required)} kg</td>
                      <td style={{ color: "var(--lime)" }}>{fmt(d.quantity_fulfilled)} kg</td>
                      <td>{fmtInr(d.maximum_price)}/kg</td>
                      <td><span className="badge badge-cyan">{d.quality_requirement}</span></td>
                      <td style={{ color: isUrgent ? "var(--orange)" : "var(--text-secondary)", fontSize: 12 }}>
                        {ddl
                          ? ddl.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td>
                        <span className={`badge ${d.status === "open" ? "badge-lime" : "badge-cyan"}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          try { await api.cancelDemand(d.id); toast("Demand cancelled", "info"); load(); }
                          catch (e) { toast(e.message, "error"); }
                        }}>Cancel</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Post Demand Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Post Demand Request</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={createDemand}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Buyer</label>
                    <select className="input-field" required value={form.buyer_id}
                      onChange={(e) => setForm({ ...form, buyer_id: e.target.value })}>
                      <option value="">Select buyer…</option>
                      {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Produce Type</label>
                    <input className="input-field" required placeholder="e.g. Tomatoes"
                      value={form.produce_type} onChange={(e) => setForm({ ...form, produce_type: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Required Quantity (kg)</label>
                    <input className="input-field" type="number" required min="1"
                      value={form.quantity_required} onChange={(e) => setForm({ ...form, quantity_required: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Maximum Price (₹/kg)</label>
                    <input className="input-field" type="number" required min="1"
                      value={form.maximum_price} onChange={(e) => setForm({ ...form, maximum_price: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Quality Requirement</label>
                    <input className="input-field" placeholder="e.g. A,B"
                      value={form.quality_requirement} onChange={(e) => setForm({ ...form, quality_requirement: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Delivery Deadline</label>
                    <input className="input-field" type="datetime-local" required
                      value={form.delivery_deadline} onChange={(e) => setForm({ ...form, delivery_deadline: e.target.value })} />
                  </div>
                  <div className="form-group form-full">
                    <label>Delivery Location</label>
                    <input className="input-field" placeholder="e.g. Mumbai Retail Store"
                      value={form.delivery_location} onChange={(e) => setForm({ ...form, delivery_location: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post Demand</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
