import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { parseApiDate } from "../utils/date";
import {
  ShoppingBag,
  Plus,
  Boxes,
  Truck,
  CheckCircle2,
  Sparkles,
  MapPin,
  Phone,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
  Check,
  Ban,
  Zap,
  Radio,
  Flame,
} from "lucide-react";

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—");
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

export default function BuyerDashboard() {
  const { buyerUser, openLogin } = useAuth();
  const toast = useToast();

  const [demands, setDemands] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliersMap, setSuppliersMap] = useState({});
  const [availableSurplus, setAvailableSurplus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Real-time Instant Buy & Auto-Procure state
  const [autoProcureActive, setAutoProcureActive] = useState(true);
  const [instantBuyBatch, setInstantBuyBatch] = useState(null);
  const [instantBuyQty, setInstantBuyQty] = useState("");
  const [instantBuyLocation, setInstantBuyLocation] = useState("");
  const prevBatchCountRef = useRef(null);

  // Form state for creating demand
  const [form, setForm] = useState({
    produce_type: "Tomatoes",
    quantity_required: "150",
    maximum_price: "20",
    quality_requirement: "A,B",
    delivery_hours: "24",
    delivery_location: "",
  });

  const loadData = useCallback(async (isSilent = false) => {
    if (!buyerUser) return;
    try {
      const [allDemands, allProposals, allOrders, allSuppliers, allSurplus] = await Promise.all([
        api.demands(),
        api.proposals(),
        api.orders(),
        api.suppliers(),
        api.inventory(),
      ]);

      const sMap = {};
      allSuppliers.forEach((s) => {
        sMap[s.id] = s;
      });
      setSuppliersMap(sMap);

      // Filter for this buyer
      const myDemands = allDemands.filter((d) => d.buyer_id === buyerUser.id);
      const myDemandIds = new Set(myDemands.map((d) => d.id));

      const myProposals = allProposals.filter((p) => myDemandIds.has(p.demand_id));
      const myOrders = allOrders.filter((o) => o.buyer_id === buyerUser.id);
      const openSurplus = allSurplus.filter((s) => s.status === "available");

      // Notify buyer if new surplus was just listed by a seller in real-time
      if (prevBatchCountRef.current !== null && openSurplus.length > prevBatchCountRef.current) {
        const diff = openSurplus.length - prevBatchCountRef.current;
        const newest = openSurplus[openSurplus.length - 1];
        toast(`🟢 REAL-TIME ALERT: Farmer listed ${newest.quantity_available} kg fresh ${newest.produce_type} @ ₹${newest.asking_price}/kg!`, "success");
      }
      prevBatchCountRef.current = openSurplus.length;

      setDemands(myDemands);
      setProposals(myProposals);
      setOrders(myOrders);
      setAvailableSurplus(openSurplus);

      if (!form.delivery_location && buyerUser.location) {
        setForm((prev) => ({ ...prev, delivery_location: buyerUser.location }));
      }
    } catch (err) {
      if (!isSilent) toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [buyerUser, toast, form.delivery_location]);

  // Initial load and live 3.5s real-time streaming interval
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time Auto-Procure trigger when matching proposals arrive
  useEffect(() => {
    if (!autoProcureActive || !buyerUser) return;
    const pendingForMe = proposals.filter((p) => p.status === "pending");
    if (pendingForMe.length > 0) {
      api.autoProcure(buyerUser.id)
        .then((res) => {
          if (res.auto_procured_count > 0) {
            toast(`⚡ Real-Time Auto-Buy Executed! ${res.auto_procured_count} matching lot(s) purchased immediately.`, "success");
            loadData(true);
          }
        })
        .catch(() => {});
    }
  }, [autoProcureActive, buyerUser, proposals, loadData, toast]);

  const handleCreateDemand = async (e) => {
    e.preventDefault();
    if (!buyerUser) return;
    try {
      const hours = Number(form.delivery_hours) || 24;
      const deadline = new Date(Date.now() + hours * 3600 * 1000).toISOString();

      await api.createDemand({
        buyer_id: buyerUser.id,
        produce_type: form.produce_type,
        quantity_required: Number(form.quantity_required),
        maximum_price: Number(form.maximum_price),
        quality_requirement: form.quality_requirement,
        delivery_deadline: deadline,
        delivery_location: form.delivery_location || buyerUser.location,
      });

      toast(`Demand for ${form.quantity_required} kg of ${form.produce_type} posted! AI matching initiated.`, "success");
      setShowDemandModal(false);
      await loadData();
    } catch (err) {
      toast(err.message || "Failed to post demand", "error");
    }
  };

  const handleConfirmProposal = async (proposalId) => {
    setActionLoading(proposalId);
    try {
      const order = await api.confirmOrder(proposalId);
      toast(`Order #${order.id} confirmed! Vehicle allocated and pickup scheduled.`, "success");
      await loadData();
    } catch (err) {
      toast(err.message || "Failed to confirm proposal", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDemand = async (demandId) => {
    try {
      await api.cancelDemand(demandId);
      toast(`Demand #${demandId} cancelled`, "info");
      await loadData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleAdvanceOrder = async (orderId, nextStatus) => {
    try {
      await api.advanceOrder(orderId, nextStatus);
      toast(`Order #${orderId} marked as ${nextStatus}`, "success");
      await loadData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleInstantBuy = async (e) => {
    e.preventDefault();
    if (!buyerUser || !instantBuyBatch) return;
    const qty = Number(instantBuyQty);
    if (!qty || qty <= 0) {
      toast("Please enter a valid purchase quantity", "error");
      return;
    }
    setActionLoading("instant-" + instantBuyBatch.id);
    try {
      const order = await api.instantBuy(instantBuyBatch.id, {
        buyer_id: buyerUser.id,
        quantity: qty,
        delivery_location: instantBuyLocation || buyerUser.location,
      });
      toast(`⚡ Instant Purchase Confirmed! Order #ORD-${order.id} for ${qty} kg ${instantBuyBatch.produce_type}. Vehicle allocated!`, "success");
      setInstantBuyBatch(null);
      await loadData();
    } catch (err) {
      toast(err.message || "Instant purchase failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const totalProcuredKg = orders
    .filter((o) => o.status === "delivered")
    .reduce((acc, o) => acc + (o.quantity || 0), 0);
  const activeOrdersCount = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;

  if (!buyerUser) {
    return (
      <div className="glass-card" style={{ padding: 48, textAlign: "center", maxWidth: 500, margin: "40px auto" }}>
        <ShoppingBag size={44} style={{ color: "var(--burgundy)", margin: "0 auto 16px auto" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, marginBottom: 8 }}>
          Wholesale Buyer Access
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
          Please select or register your commercial kitchen, retailer, or wholesale profile.
        </p>
        <button className="btn btn-primary" onClick={() => openLogin("buyer")}>
          Select Buyer Account
        </button>
      </div>
    );
  }

  return (
    <div className="buyer-dashboard-page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Buyer Identity Banner ── */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          border: "1px solid var(--dusty-pink-border)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(250,240,244,0.7) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--burgundy-dim)",
              color: "var(--burgundy)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShoppingBag size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--cream)" }}>
                {buyerUser.name}
              </h2>
              <span className="badge badge-dusty-pink" style={{ fontSize: 11, textTransform: "capitalize" }}>
                {buyerUser.buyer_type || "Commercial Buyer"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={13} /> {buyerUser.location}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Phone size={13} /> {buyerUser.contact || "+91-Verified"}
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
            Live Stream (3s)
          </div>

          <button
            className={`btn btn-sm ${autoProcureActive ? "btn-primary" : "btn-ghost"}`}
            style={
              autoProcureActive
                ? { background: "var(--lite-green)", color: "#111", fontWeight: 700 }
                : { border: "1px dashed var(--dusty-pink-border)" }
            }
            onClick={() => {
              const nxt = !autoProcureActive;
              setAutoProcureActive(nxt);
              toast(
                nxt
                  ? "⚡ Real-Time Auto-Buy ACTIVATED! Matches will be auto-purchased instantly."
                  : "Auto-Buy paused. Manual approval mode active.",
                nxt ? "success" : "info"
              );
            }}
            title="Automatically approves and buys farm surplus that matches your price and quality limits in real time"
          >
            <Zap size={14} />
            <span>{autoProcureActive ? "Auto-Buy ON" : "Auto-Buy OFF"}</span>
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => openLogin("buyer")}>
            Switch Buyer
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--burgundy)" }}
            onClick={() => setShowDemandModal(true)}
          >
            <Plus size={16} />
            <span>Upload Buy Demand</span>
          </button>
        </div>
      </div>

      {/* ── KPI Grid for Buyer ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Open Buy Demands</span>
            <div className="kpi-icon" style={{ background: "var(--burgundy-dim)", color: "var(--burgundy)" }}>
              <Boxes size={16} />
            </div>
          </div>
          <div className="kpi-value">{demands.length}</div>
          <div className="kpi-sub">Active procurement requirements</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Proposals For Approval</span>
            <div className="kpi-icon" style={{ background: "var(--dusty-pink-dim)", color: "var(--dusty-pink)" }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: pendingProposals.length ? "var(--burgundy)" : "inherit" }}>
            {pendingProposals.length}
          </div>
          <div className="kpi-sub">{pendingProposals.length ? "Action required" : "All matches cleared"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Active Dispatches</span>
            <div className="kpi-icon" style={{ background: "var(--lite-green-dim)", color: "var(--lite-green)" }}>
              <Truck size={16} />
            </div>
          </div>
          <div className="kpi-value">{activeOrdersCount}</div>
          <div className="kpi-sub">In-transit & scheduled pickups</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Procured</span>
            <div className="kpi-icon" style={{ background: "var(--lite-green-dim)", color: "var(--lite-green)" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: "var(--lite-green)" }}>
            {totalProcuredKg.toLocaleString()} kg
          </div>
          <div className="kpi-sub">Delivered & verified farm-fresh</div>
        </div>
      </div>

      {/* ── Section 1: Actionable Match Proposals Ready For Approval ── */}
      <div className="glass-card" style={{ border: pendingProposals.length ? "1.5px solid var(--burgundy)" : undefined }}>
        <div className="card-header">
          <div>
            <h2>
              <Sparkles size={17} style={{ color: "var(--burgundy)" }} />
              Action Required: Feasible Surplus Proposals
            </h2>
            <p>Algorithmic matches found for your open demands respecting your price ceilings & quality grades</p>
          </div>
          <span className="badge badge-burgundy">{pendingProposals.length} Actionable</span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {pendingProposals.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No pending match proposals awaiting your approval right now. When farmers list matching surplus, they will appear here!
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Supplier / Origin</th>
                    <th>Produce & Grade</th>
                    <th>Proposed Qty</th>
                    <th>Agreed Rate</th>
                    <th>Est. Transport</th>
                    <th>Gross Total</th>
                    <th>AI Score</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProposals.map((p) => {
                    const sup = suppliersMap[p.batch_id] || { name: `Farmer #${p.batch_id}`, location: "Maharashtra" };
                    const gross = p.proposed_quantity * p.proposed_price;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>PROP-{p.id}</span>
                        </td>
                        <td>
                          <div>
                            <strong>{sup.name}</strong>
                            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{sup.location}</div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-lite-green" style={{ fontSize: 11 }}>
                            Grade Compatible
                          </span>
                        </td>
                        <td>
                          <strong>{fmt(p.proposed_quantity)} kg</strong>
                        </td>
                        <td>
                          <strong style={{ color: "var(--cream)" }}>{fmtInr(p.proposed_price)}/kg</strong>
                        </td>
                        <td>{fmtInr(p.estimated_transport_cost)}</td>
                        <td>
                          <strong>{fmtInr(gross)}</strong>
                        </td>
                        <td>
                          <span className="badge badge-lite-green">
                            {Math.round((p.score || 0.9) * 100)}% fit
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: "var(--burgundy)" }}
                            disabled={actionLoading === p.id}
                            onClick={() => handleConfirmProposal(p.id)}
                          >
                            <Check size={14} />
                            <span>{actionLoading === p.id ? "Confirming..." : "Approve & Buy"}</span>
                          </button>
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

      {/* ── Section 2: My Open Buy Demands ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Boxes size={17} style={{ color: "var(--dusty-pink)" }} />
              My Open Buy Demands
            </h2>
            <p>Active requirements uploaded to the MandiPulse network</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {demands.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No open demands uploaded. Click <strong>"Upload Buy Demand"</strong> above to let MandiPulse AI find surplus for you!
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Demand ID</th>
                    <th>Produce Needed</th>
                    <th>Quantity Required</th>
                    <th>Fulfilled</th>
                    <th>Max Price Ceiling</th>
                    <th>Acceptable Grades</th>
                    <th>Delivery Deadline</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {demands.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>REQ-{d.id}</span>
                      </td>
                      <td>
                        <strong>{d.produce_type}</strong>
                      </td>
                      <td>
                        <strong>{fmt(d.quantity_required)} kg</strong>
                      </td>
                      <td>{fmt(d.quantity_fulfilled)} kg</td>
                      <td>
                        <strong style={{ color: "var(--burgundy)" }}>Max {fmtInr(d.maximum_price)}/kg</strong>
                      </td>
                      <td>
                        <span className="badge badge-muted">Grades {d.quality_requirement}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                          {new Date(d.delivery_deadline).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--red)" }}
                          onClick={() => handleCancelDemand(d.id)}
                        >
                          <Ban size={13} />
                          <span>Cancel</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Orders & Delivery Tracking ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Truck size={17} style={{ color: "var(--lite-green)" }} />
              Active Purchases & Delivery Tracker
            </h2>
            <p>Confirmed orders dispatched from mandis with cold-chain transit tracking</p>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {orders.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No confirmed orders yet. Approve a proposal above to initiate logistics dispatch.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Quantity</th>
                    <th>Agreed Rate</th>
                    <th>Gross Amount</th>
                    <th>Status</th>
                    <th>Logistics Stage</th>
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
                        <strong>{fmtInr(o.gross_value)}</strong>
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
                        <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                          {o.status === "confirmed" && "Pickup being scheduled with regional vehicle"}
                          {o.status === "pickup_scheduled" && "Driver dispatched to mandi"}
                          {o.status === "picked_up" && "Loaded onto vehicle, en route"}
                          {o.status === "in_transit" && "In transit to your delivery destination"}
                          {o.status === "delivered" && "Delivered & inspected"}
                        </div>
                      </td>
                      <td>
                        {o.status === "in_transit" && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: "var(--lite-green)", borderColor: "var(--lite-green-border)" }}
                            onClick={() => handleAdvanceOrder(o.id, "delivered")}
                          >
                            <CheckCircle2 size={13} />
                            <span>Confirm Receipt</span>
                          </button>
                        )}
                        {o.status === "picked_up" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleAdvanceOrder(o.id, "in_transit")}
                          >
                            Mark In Transit
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

      {/* ── Section 4: Live Marketplace Surplus Feed ── */}
      <div className="glass-card">
        <div className="card-header">
          <div>
            <h2>
              <Boxes size={17} style={{ color: "var(--cream)" }} />
              Live Available Surplus Across Mandis (Real-Time Feed)
            </h2>
            <p>Fresh stock listed by nearby farmers ready for one-click real-time procurement</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--lite-green)",
                boxShadow: "0 0 6px var(--lite-green)",
                display: "inline-block",
              }}
            />
            <span className="badge badge-lite-green">{availableSurplus.length} Lots Available</span>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {availableSurplus.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-subtle)" }}>
              No surplus listed at this exact second. As soon as a farmer uploads produce, it appears here in real-time!
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Produce</th>
                    <th>Farmer / Origin</th>
                    <th>Quality Grade</th>
                    <th>Available Stock</th>
                    <th>Asking Rate</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSurplus.map((s) => {
                    const sup = suppliersMap[s.supplier_id] || { name: `Farmer #${s.supplier_id}`, location: "Maharashtra" };
                    return (
                      <tr key={s.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>BATCH-{s.id}</span>
                        </td>
                        <td>
                          <strong>{s.produce_type}</strong>
                        </td>
                        <td>
                          <div>
                            <strong style={{ fontSize: 13 }}>{sup.name}</strong>
                            <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{sup.location}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${s.quality_grade === "A" ? "badge-lite-green" : "badge-dusty-pink"}`}>
                            Grade {s.quality_grade}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: "var(--cream)" }}>{fmt(s.quantity_available)} kg</strong>
                        </td>
                        <td>
                          <strong style={{ color: "var(--burgundy)" }}>{fmtInr(s.asking_price)}/kg</strong>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: "var(--lite-green)", color: "#111", fontWeight: 700 }}
                              onClick={() => {
                                setInstantBuyBatch(s);
                                setInstantBuyQty(String(Math.min(s.quantity_available, 150)));
                                setInstantBuyLocation(buyerUser.location || "");
                              }}
                            >
                              <Zap size={13} />
                              <span>⚡ Instant Buy</span>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setForm({
                                  produce_type: s.produce_type,
                                  quantity_required: String(Math.min(s.quantity_available, 200)),
                                  maximum_price: String(s.asking_price + 2),
                                  quality_requirement: s.quality_grade,
                                  delivery_hours: "24",
                                  delivery_location: buyerUser.location,
                                });
                                setShowDemandModal(true);
                              }}
                            >
                              Match
                            </button>
                          </div>
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

      {/* ── Modal: Upload Buy Demand ── */}
      {showDemandModal && (
        <div className="modal-backdrop" onClick={() => setShowDemandModal(false)}>
          <div
            className="modal-box glass-card"
            style={{ maxWidth: 500, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>
                <ShoppingBag size={18} style={{ color: "var(--burgundy)" }} />
                Post Buy Requirement (Demand)
              </h2>
              <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setShowDemandModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDemand} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Produce Needed *</label>
                <select
                  className="form-select"
                  value={form.produce_type}
                  onChange={(e) => setForm({ ...form, produce_type: e.target.value })}
                  required
                >
                  <option value="Tomatoes">Tomatoes</option>
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
                  <label className="form-label">Quantity Needed (kg) *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="10"
                    placeholder="e.g. 200"
                    required
                    value={form.quantity_required}
                    onChange={(e) => setForm({ ...form, quantity_required: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Price Budget (₹/kg) *</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    placeholder="e.g. 22"
                    required
                    value={form.maximum_price}
                    onChange={(e) => setForm({ ...form, maximum_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Quality Grade Allowed</label>
                  <select
                    className="form-select"
                    value={form.quality_requirement}
                    onChange={(e) => setForm({ ...form, quality_requirement: e.target.value })}
                  >
                    <option value="A,B">Grades A & B (Commercial standard)</option>
                    <option value="A">Grade A Only (Premium)</option>
                    <option value="B">Grade B Only</option>
                    <option value="A,B,C">Any Grade (Processing/Sauce)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Delivery Needed Within *</label>
                  <select
                    className="form-select"
                    value={form.delivery_hours}
                    onChange={(e) => setForm({ ...form, delivery_hours: e.target.value })}
                  >
                    <option value="12">Within 12 Hours</option>
                    <option value="24">Within 24 Hours</option>
                    <option value="48">Within 48 Hours</option>
                    <option value="72">Within 3 Days</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Address / Destination *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Powai, Mumbai"
                  required
                  value={form.delivery_location}
                  onChange={(e) => setForm({ ...form, delivery_location: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDemandModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, background: "var(--burgundy)" }}
                >
                  <Plus size={16} />
                  <span>Post Demand & Match</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Instant Direct Buy ── */}
      {instantBuyBatch && (
        <div className="modal-backdrop" onClick={() => setInstantBuyBatch(null)}>
          <div
            className="modal-box glass-card"
            style={{ maxWidth: 520, width: "95%", border: "1.5px solid var(--lite-green)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ borderBottom: "1px solid var(--dusty-pink-border)" }}>
              <div>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <Zap size={20} style={{ color: "var(--lite-green)" }} />
                  Real-Time Instant Procurement
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-subtle)" }}>
                  Direct farm-to-door purchase with automated cold-chain logistics allocation
                </p>
              </div>
              <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setInstantBuyBatch(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInstantBuy} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Lot Summary Box */}
              <div
                style={{
                  background: "rgba(0,0,0,0.03)",
                  border: "1px solid var(--dusty-pink-border)",
                  borderRadius: "var(--r-md)",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {instantBuyBatch.produce_type}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 2 }}>
                    Origin: {suppliersMap[instantBuyBatch.supplier_id]?.name || "Mandi Farmer"} • {suppliersMap[instantBuyBatch.supplier_id]?.location || "Maharashtra"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--cream)" }}>
                    {fmtInr(instantBuyBatch.asking_price)}/kg
                  </div>
                  <span className="badge badge-lite-green" style={{ fontSize: 11 }}>
                    Grade {instantBuyBatch.quality_grade}
                  </span>
                </div>
              </div>

              {/* Quantity Selection */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Procurement Quantity (kg) *</label>
                  <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                    Available Stock: <strong>{instantBuyBatch.quantity_available} kg</strong>
                  </span>
                </div>
                <input
                  type="number"
                  className="form-input"
                  min={instantBuyBatch.min_sale_quantity || 10}
                  max={instantBuyBatch.quantity_available}
                  step="1"
                  required
                  value={instantBuyQty}
                  onChange={(e) => setInstantBuyQty(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {[50, 100, 200, instantBuyBatch.quantity_available].map((q) => {
                    const val = Math.min(q, instantBuyBatch.quantity_available);
                    return (
                      <button
                        key={q}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, padding: "3px 8px" }}
                        onClick={() => setInstantBuyQty(String(val))}
                      >
                        {q === instantBuyBatch.quantity_available ? "Max (" + val + "kg)" : val + "kg"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="form-group">
                <label className="form-label">Delivery Destination *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bandra West, Mumbai"
                  required
                  value={instantBuyLocation}
                  onChange={(e) => setInstantBuyLocation(e.target.value)}
                />
              </div>

              {/* Real-Time Cost Breakdown */}
              {(() => {
                const q = Number(instantBuyQty) || 0;
                const cropVal = q * instantBuyBatch.asking_price;
                const distEst = 80;
                const transportEst = Math.round(distEst * 12);
                const platformFee = Math.round(cropVal * 0.02);
                const grossTotal = Math.round(cropVal + transportEst + platformFee);
                return (
                  <div
                    style={{
                      background: "rgba(102, 232, 160, 0.08)",
                      border: "1px dashed rgba(102, 232, 160, 0.35)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 16px",
                      fontSize: 13,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Produce Value ({q} kg × {fmtInr(instantBuyBatch.asking_price)})</span>
                      <span>{fmtInr(cropVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-subtle)" }}>
                      <span>Regional Vehicle Dispatch (~80km)</span>
                      <span>{fmtInr(transportEst)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-subtle)" }}>
                      <span>Platform Assurance & Quality Fee (2%)</span>
                      <span>{fmtInr(platformFee)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "1px solid rgba(0,0,0,0.08)",
                        paddingTop: 6,
                        fontWeight: 700,
                        fontSize: 15,
                        color: "var(--cream)",
                      }}
                    >
                      <span>Total Estimated Cost</span>
                      <span style={{ color: "var(--lite-green)" }}>{fmtInr(grossTotal)}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => setInstantBuyBatch(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, background: "var(--lite-green)", color: "#111", fontWeight: 700 }}
                  disabled={actionLoading === "instant-" + instantBuyBatch.id}
                >
                  <Zap size={16} />
                  <span>
                    {actionLoading === "instant-" + instantBuyBatch.id
                      ? "Allocating Vehicle..."
                      : "⚡ Confirm & Buy Now"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
