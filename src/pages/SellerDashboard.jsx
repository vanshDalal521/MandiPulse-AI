import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { parseApiDate } from "../utils/date";
import {
  Store,
  Plus,
  Boxes,
  Clock,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  MapPin,
  Phone,
  ArrowRight,
  X,
  Zap,
} from "lucide-react";

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—");
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

function hoursLeft(until) {
  const expiry = parseApiDate(until);
  if (!expiry) return 0;
  return Math.max(0, (expiry - Date.now()) / 36e5);
}

function freshnessBadge(h) {
  if (h <= 6) return { cls: "badge-red", label: `Critical: ${h.toFixed(1)}h left` };
  if (h <= 24) return { cls: "badge-orange", label: `Urgent: ${h.toFixed(1)}h left` };
  return { cls: "badge-lite-green", label: `Fresh: ${(h / 24).toFixed(1)}d left` };
}

export default function SellerDashboard() {
  const { sellerUser, openLogin } = useAuth();
  const toast = useToast();

  const [batches, setBatches] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [buyersMap, setBuyersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const prevOrdersCountRef = useRef(null);

  // Form for listing surplus
  const [form, setForm] = useState({
    produce_type: "Tomatoes",
    quantity_available: "500",
    quality_grade: "B",
    asking_price: "18",
    shelf_life_hours: "24",
    min_sale_quantity: "50",
  });

  const loadData = useCallback(async (isSilent = false) => {
    if (!sellerUser) return;
    try {
      const [allBatches, allProposals, allOrders, allBuyers] = await Promise.all([
        api.inventory(),
        api.proposals(),
        api.orders(),
        api.buyers(),
      ]);

      const bMap = {};
      allBuyers.forEach((b) => {
        bMap[b.id] = b;
      });
      setBuyersMap(bMap);

      // Filter for this seller
      const myBatches = allBatches.filter((b) => b.supplier_id === sellerUser.id);
      const myBatchIds = new Set(myBatches.map((b) => b.id));

      const myProposals = allProposals.filter((p) => myBatchIds.has(p.batch_id));
      const myOrders = allOrders.filter((o) => o.supplier_id === sellerUser.id);

      // Real-time sale notification
      if (prevOrdersCountRef.current !== null && myOrders.length > prevOrdersCountRef.current) {
        const newest = myOrders[myOrders.length - 1];
        toast(`🟢 REAL-TIME SALE! Buyer purchased ${newest.quantity}kg ${newest.produce_type || "produce"}! Order #ORD-${newest.id} confirmed.`, "success");
      }
      prevOrdersCountRef.current = myOrders.length;

      setBatches(myBatches);
      setProposals(myProposals);
      setOrders(myOrders);
    } catch (err) {
      if (!isSilent) toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [sellerUser, toast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreateSurplus = async (e) => {
    e.preventDefault();
    if (!sellerUser) {
      toast("Please log in as a seller first", "error");
      return;
    }
    try {
      const hours = Number(form.shelf_life_hours) || 24;
      const usableUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();

      await api.createInventory({
        supplier_id: sellerUser.id,
        produce_type: form.produce_type,
        quantity_available: Number(form.quantity_available),
        quality_grade: form.quality_grade,
        asking_price: Number(form.asking_price),
        usable_until: usableUntil,
        min_sale_quantity: Number(form.min_sale_quantity),
        unit: "kg",
      });

      toast(`Listed ${form.quantity_available} kg of ${form.produce_type}! AI Matching triggered.`, "success");
      setShowModal(false);
      await loadData();
    } catch (err) {
      toast(err.message || "Failed to list surplus", "error");
    }
  };

  const handleAdvanceStatus = async (orderId, nextStatus) => {
    try {
      await api.advanceOrder(orderId, nextStatus);
      toast(`Order #${orderId} marked as ${nextStatus}`, "success");
      await loadData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const totalListedKg = batches.reduce((acc, b) => acc + (b.quantity_available || 0) + (b.quantity_reserved || 0), 0);
  const totalProceeds = orders.reduce((acc, o) => acc + (o.supplier_proceeds || 0), 0);

  if (!sellerUser) {
    return (
      <div className="glass-card" style={{ padding: 48, textAlign: "center", maxWidth: 500, margin: "40px auto" }}>
        <Store size={44} style={{ color: "var(--lite-green)", margin: "0 auto 16px auto" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, marginBottom: 8 }}>
          Seller Portal Access
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
          Please select or register your farm/supplier profile to access the seller dashboard.
        </p>
        <button className="btn btn-primary" onClick={() => openLogin("seller")}>
          Select Seller Account
        </button>
      </div>
    );
  }

  return (
    <div className="seller-dashboard-page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Seller Identity Banner ── */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          border: "1px solid var(--lite-green-border)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,250,244,0.7) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--lite-green-dim)",
              color: "var(--lite-green)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Store size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--cream)" }}>
                {sellerUser.name}
              </h2>
              <span className="badge badge-lite-green" style={{ fontSize: 11 }}>
                Verified Producer
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={13} /> {sellerUser.location}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Phone size={13} /> {sellerUser.contact || "+91-Verified"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(102, 232, 160, 0.12)",
              border: "1px solid rgba(102, 232, 160, 0.35)",
              padding: "5px 12px",
              borderRadius: "var(--r-full)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--lite-green)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--lite-green)",
                boxShadow: "0 0 8px var(--lite-green)",
                display: "inline-block",
              }}
            />
            Live Sales Stream (3s)
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => openLogin("seller")}>
            Switch Producer
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--lite-green)", borderColor: "var(--lite-green-border)" }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            <span>List Surplus Produce</span>
          </button>
        </div>
      </div>

      {/* ── KPI Grid for Seller ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Active Surplus Batches</span>
            <div className="kpi-icon" style={{ background: "var(--lite-green-dim)", color: "var(--lite-green)" }}>
              <Boxes size={16} />
            </div>
          </div>
          <div className="kpi-value">{batches.filter((b) => b.status === "available").length}</div>
          <div className="kpi-sub">Ready for automated match</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Listed Produce</span>
            <div className="kpi-icon" style={{ background: "var(--lite-green-dim)", color: "var(--lite-green)" }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-value">{totalListedKg.toLocaleString()} kg</div>
          <div className="kpi-sub">Across all quality grades</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Match Proposals</span>
            <div className="kpi-icon" style={{ background: "var(--dusty-pink-dim)", color: "var(--dusty-pink)" }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="kpi-value">{proposals.length}</div>
          <div className="kpi-sub">{proposals.filter((p) => p.status === "pending").length} awaiting buyer approval</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Earned Proceeds</span>
            <div className="kpi-icon" style={{ background: "var(--lite-green-dim)", color: "var(--lite-green)" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: "var(--lite-green)" }}>
            {fmtInr(totalProceeds)}
          </div>
          <div className="kpi-sub">Net realized after transport</div>
        </div>
      </div>

      {/* ── Section 1: Active Surplus Batches ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Boxes size={17} style={{ color: "var(--lite-green)" }} />
              My Listed Surplus Batches
            </h2>
            <p>Live inventory lots currently monitored for regional buyer matching</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {batches.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No surplus listed yet. Click <strong>"List Surplus Produce"</strong> above to list perishable stock!
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Produce</th>
                    <th>Quality Grade</th>
                    <th>Available Qty</th>
                    <th>Reserved Qty</th>
                    <th>Asking Price</th>
                    <th>Freshness Window</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const h = hoursLeft(b.usable_until);
                    const fresh = freshnessBadge(h);
                    return (
                      <tr key={b.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>#{b.id}</span>
                        </td>
                        <td>
                          <strong>{b.produce_type}</strong>
                        </td>
                        <td>
                          <span className={`badge ${b.quality_grade === "A" ? "badge-lite-green" : "badge-dusty-pink"}`}>
                            Grade {b.quality_grade}
                          </span>
                        </td>
                        <td>
                          <strong>{fmt(b.quantity_available)} kg</strong>
                        </td>
                        <td>{b.quantity_reserved > 0 ? `${fmt(b.quantity_reserved)} kg` : "—"}</td>
                        <td>{fmtInr(b.asking_price)}/kg</td>
                        <td>
                          <span className={`badge ${fresh.cls}`}>
                            <Clock size={11} /> {fresh.label}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              b.status === "available"
                                ? "badge-lite-green"
                                : b.status === "reserved"
                                ? "badge-orange"
                                : "badge-muted"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Match Proposals Generated for this Producer ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Sparkles size={17} style={{ color: "var(--burgundy)" }} />
              Buyer Match Proposals
            </h2>
            <p>Feasible pairs calculated by the AI Agent matching your surplus to regional demand</p>
          </div>
          <span className="badge badge-dusty-pink">{proposals.length} Matches Found</span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {proposals.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No active match proposals found for this producer yet. They appear automatically as buyer demands arrive.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Matched Buyer</th>
                    <th>Allocated Qty</th>
                    <th>Agreed Price</th>
                    <th>Est. Transport</th>
                    <th>Supplier Proceeds</th>
                    <th>AI Score</th>
                    <th>Buyer Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const buyer = buyersMap[p.demand_id] || { name: `Buyer #${p.demand_id}`, location: "Maharashtra" };
                    return (
                      <tr key={p.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>PROP-{p.id}</span>
                        </td>
                        <td>
                          <div>
                            <strong>{buyer.name}</strong>
                            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{buyer.location}</div>
                          </div>
                        </td>
                        <td>
                          <strong>{fmt(p.proposed_quantity)} kg</strong>
                        </td>
                        <td>{fmtInr(p.proposed_price)}/kg</td>
                        <td>
                          <span style={{ color: "var(--dusty-pink)" }}>{fmtInr(p.estimated_transport_cost)}</span>
                        </td>
                        <td>
                          <strong style={{ color: "var(--lite-green)" }}>{fmtInr(p.supplier_proceeds)}</strong>
                        </td>
                        <td>
                          <span className="badge badge-lite-green">{Math.round((p.score || 0.9) * 100)}%</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              p.status === "accepted"
                                ? "badge-lite-green"
                                : p.status === "pending"
                                ? "badge-orange"
                                : "badge-red"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Dispatches & Completed Orders ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Truck size={17} style={{ color: "var(--lite-green)" }} />
              Logistics & Dispatches
            </h2>
            <p>Active pickup dispatches and confirmed order fulfillments</p>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {orders.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No orders confirmed yet. When buyers approve proposals, dispatches show up here.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Quantity</th>
                    <th>Agreed Rate</th>
                    <th>Net Proceeds</th>
                    <th>Delivery Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>ORD-{o.id}</span>
                      </td>
                      <td>
                        <strong>{fmt(o.quantity)} kg</strong>
                      </td>
                      <td>{fmtInr(o.agreed_price)}/kg</td>
                      <td>
                        <strong style={{ color: "var(--lite-green)" }}>{fmtInr(o.supplier_proceeds)}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            o.status === "delivered"
                              ? "badge-lite-green"
                              : o.status === "in_transit"
                              ? "badge-cyan"
                              : o.status === "picked_up"
                              ? "badge-orange"
                              : "badge-dusty-pink"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.status === "confirmed" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleAdvanceStatus(o.id, "pickup_scheduled")}
                          >
                            Schedule Pickup
                          </button>
                        )}
                        {o.status === "pickup_scheduled" && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: "var(--lite-green)", borderColor: "var(--lite-green-border)" }}
                            onClick={() => handleAdvanceStatus(o.id, "picked_up")}
                          >
                            Mark Picked Up
                          </button>
                        )}
                        {o.status === "picked_up" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleAdvanceStatus(o.id, "in_transit")}
                          >
                            In Transit
                          </button>
                        )}
                        {o.status === "delivered" && (
                          <span style={{ fontSize: 12, color: "var(--lite-green)", fontWeight: 600 }}>
                            Delivered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: List Surplus Produce ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="modal-box glass-card"
            style={{ maxWidth: 500, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>
                <Store size={18} style={{ color: "var(--lite-green)" }} />
                List Surplus Produce Batch
              </h2>
              <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSurplus} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Produce Type *</label>
                <select
                  className="form-select"
                  value={form.produce_type}
                  onChange={(e) => setForm({ ...form, produce_type: e.target.value })}
                  required
                >
                  <option value="Tomatoes">Tomatoes (High Perishability)</option>
                  <option value="Potatoes">Potatoes</option>
                  <option value="Onions">Onions</option>
                  <option value="Spinach">Spinach / Green Leafy</option>
                  <option value="Bananas">Bananas</option>
                  <option value="Cabbage">Cabbage</option>
                  <option value="Cauliflower">Cauliflower</option>
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Available Surplus (kg) *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="10"
                    placeholder="e.g. 500"
                    required
                    value={form.quantity_available}
                    onChange={(e) => setForm({ ...form, quantity_available: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Quality Grade</label>
                  <select
                    className="form-select"
                    value={form.quality_grade}
                    onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}
                  >
                    <option value="A">Grade A – Premium Fresh</option>
                    <option value="B">Grade B – Good Commercial</option>
                    <option value="C">Grade C – Processing Grade</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Asking Price (₹/kg) *</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    placeholder="e.g. 18"
                    required
                    value={form.asking_price}
                    onChange={(e) => setForm({ ...form, asking_price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Freshness Shelf-Life *</label>
                  <select
                    className="form-select"
                    value={form.shelf_life_hours}
                    onChange={(e) => setForm({ ...form, shelf_life_hours: e.target.value })}
                  >
                    <option value="12">12 Hours (Urgent Lot)</option>
                    <option value="24">24 Hours (Standard Surplus)</option>
                    <option value="48">48 Hours (2 Days)</option>
                    <option value="72">72 Hours (3 Days)</option>
                    <option value="120">5 Days</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Minimum Sale Quantity (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.min_sale_quantity}
                  onChange={(e) => setForm({ ...form, min_sale_quantity: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, background: "var(--lite-green)", borderColor: "var(--lite-green-border)" }}
                >
                  <Plus size={16} />
                  <span>List & Trigger Matching</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
