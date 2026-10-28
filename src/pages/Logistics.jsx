import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { parseApiDate } from "../utils/date";
import { AlertTriangle, ClipboardList, Package, Truck } from "lucide-react";

const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—";
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

const STATUS_COLOUR = {
  available:   "badge-lite-green",
  assigned:    "badge-dusty-pink",
  unavailable: "badge-red",
};
const ORDER_COLOUR = {
  proposed:         "badge-muted",
  confirmed:        "badge-dusty-pink",
  pickup_scheduled: "badge-burgundy",
  picked_up:        "badge-dusty-pink",
  in_transit:       "badge-orange",
  delivered:        "badge-lite-green",
  cancelled:        "badge-red",
  needs_review:     "badge-red",
};

const NEXT_STATUS = {
  confirmed:        "pickup_scheduled",
  pickup_scheduled: "picked_up",
  picked_up:        "in_transit",
  in_transit:       "delivered",
};

export default function Logistics() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [veh, ords] = await Promise.all([api.vehicles(), api.orders()]);
      setVehicles(veh);
      setOrders(ords);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const markUnavailable = async (vehicleId) => {
    try {
      const r = await api.vehicleUnavail(vehicleId);
      toast(`Vehicle #${vehicleId} offline. ${r.replanned_orders} orders replanned.`, "warning");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const advanceOrder = async (orderId, status) => {
    try {
      await api.advanceOrder(orderId, status);
      toast(`Order #${orderId} moved to "${status}"`, "success");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await api.cancelOrder(orderId);
      toast(`Order #${orderId} cancelled, inventory released`, "info");
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

  const activeOrders = orders.filter(o =>
    ["confirmed","pickup_scheduled","picked_up","in_transit"].includes(o.status)
  );

  return (
    <div className="flex-col" style={{ gap: "var(--sp-6)" }}>
      {/* Editorial Fleet Photographic Hero */}
      <div className="editorial-hero">
        <div
          className="editorial-hero-bg"
          style={{ backgroundImage: `url('/fleet_hub.jpg')` }}
        />
        <div className="editorial-hero-scrim" />
        <div className="editorial-hero-content">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span className="badge badge-pink">Cold-Chain Distribution Fleet</span>
              <span style={{ fontSize: 11, color: "var(--cream-soft)", opacity: 0.85 }}>
                Regional Hub Logistics & Autonomous Replanning
              </span>
            </div>
            <h2 className="editorial-hero-title">
              Active Cold-Chain Dispatch & Disruption Management
            </h2>
            <p className="editorial-hero-sub">
              Fleet telemetry, live order transit tracking, and recovery agents to handle vehicle breakdowns.
            </p>
          </div>
        </div>
      </div>

      {/* Disruption Panel */}
      <div className="disruption-panel">
        <AlertTriangle size={22} />
        <div style={{ flex: 1 }}>
          <h4>Disruption Simulator</h4>
          <p>
            Mark a vehicle as unavailable to trigger automatic replanning.
            The recovery agent will reassign affected orders to a replacement vehicle.
          </p>
          <div className="disruption-actions">
            {vehicles
              .filter((v) => v.status === "assigned" || v.status === "available")
              .map((v) => (
                <button key={v.id} className="btn btn-danger btn-sm" onClick={() => markUnavailable(v.id)}>
                  🚫 Vehicle #{v.id} – {v.vehicle_type} offline
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Vehicles table */}
      <div className="glass-card">
        <div className="card-header">
          <h2><Truck size={16} style={{ display: "inline", marginRight: 8 }} />Fleet Status</h2>
          <span className="badge badge-muted">{vehicles.length} vehicles</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Type</th><th>Capacity</th>
                <th>Load</th><th>Location</th><th>Cost/km</th>
                <th>Avail. Until</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const loadPct = v.capacity_kg > 0 ? Math.round(100 * v.assigned_load_kg / v.capacity_kg) : 0;
                const loadColor = loadPct >= 90 ? "var(--red)" : loadPct >= 60 ? "var(--orange)" : "var(--lime)";
                return (
                  <tr key={v.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{v.id}</td>
                    <td style={{ fontWeight: 600 }}>{v.vehicle_type}</td>
                    <td>{fmt(v.capacity_kg)} kg</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60, height: 5, background: "rgba(248,241,228,0.1)", borderRadius: 99 }}>
                          <div style={{ width: `${loadPct}%`, height: "100%", background: loadColor, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: loadColor }}>{loadPct}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.current_location}</td>
                    <td>{fmtInr(v.cost_per_km)}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {parseApiDate(v.availability_end)?.toLocaleDateString("en-IN") ?? "—"}
                    </td>
                    <td><span className={`badge ${STATUS_COLOUR[v.status] ?? "badge-muted"}`}>{v.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active orders */}
      <div className="glass-card">
        <div className="card-header">
          <h2><Package size={16} style={{ color: "var(--dusty-pink)" }} />Active Orders</h2>
          <span className="badge badge-orange">{activeOrders.length} in progress</span>
        </div>
        <div className="table-wrapper">
          {activeOrders.length === 0 ? (
            <div className="empty-state"><p>No active orders – confirm a match proposal to create one</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th><th>Qty</th><th>Value</th>
                  <th>Vehicle</th><th>ETA</th><th>Status</th>
                  <th>Advance</th><th>Cancel</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((o) => {
                  const next = NEXT_STATUS[o.status];
                  const eta = parseApiDate(o.estimated_arrival)
                    ?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) ?? "—";
                  return (
                    <tr key={o.id}>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{o.id}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(o.quantity)} kg</td>
                      <td style={{ color: "var(--lime)" }}>{fmtInr(o.gross_value)}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                        {o.vehicle_id ? `#${o.vehicle_id}` : "Unassigned"}
                      </td>
                      <td style={{ fontSize: 12 }}>{eta}</td>
                      <td>
                        <span className={`badge ${ORDER_COLOUR[o.status] ?? "badge-muted"}`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        {next ? (
                          <button className="btn btn-primary btn-sm" onClick={() => advanceOrder(o.id, next)}>
                            → {next.replace(/_/g, " ")}
                          </button>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelOrder(o.id)}>
                          Cancel
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

      {/* All orders history */}
      <div className="glass-card">
        <div className="card-header">
          <h2><ClipboardList size={16} style={{ color: "var(--dusty-pink)" }} />Order History</h2>
          <span className="badge badge-muted">{orders.length} total</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Batch</th><th>Qty</th>
                <th>Gross Value</th><th>Transport</th><th>Platform Fee</th>
                <th>Supplier Proceeds</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{o.id}</td>
                  <td>#{o.batch_id}</td>
                  <td>{fmt(o.quantity)} kg</td>
                  <td style={{ color: "var(--lime)", fontWeight: 600 }}>{fmtInr(o.gross_value)}</td>
                  <td style={{ color: "var(--orange)" }}>{fmtInr(o.transport_cost)}</td>
                  <td style={{ color: "var(--cyan)" }}>{fmtInr(o.platform_fee)}</td>
                  <td style={{ color: "var(--green)", fontWeight: 600 }}>{fmtInr(o.supplier_proceeds)}</td>
                  <td>
                    <span className={`badge ${ORDER_COLOUR[o.status] ?? "badge-muted"}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
