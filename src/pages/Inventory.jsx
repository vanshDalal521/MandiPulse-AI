import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { parseApiDate } from "../utils/date";
import { Plus, X } from "lucide-react";

const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN") : n ?? "—";
const fmtInr = (n) => `₹${fmt(Math.round(n ?? 0))}`;

const STATUS_BADGE = {
  available: "badge-lite-green",
  reserved:  "badge-dusty-pink",
  sold:      "badge-muted",
  expired:   "badge-red",
  removed:   "badge-muted",
};
const GRADE_BADGE = { A: "badge-lite-green", B: "badge-dusty-pink", C: "badge-orange" };

function hoursLeft(until) {
  const expiry = parseApiDate(until);
  if (!expiry) return 0;
  return Math.max(0, (expiry - Date.now()) / 36e5);
}
function freshnessColor(h) {
  return h <= 6 ? "var(--risk-critical)" : h <= 24 ? "var(--risk-urgent)" : "var(--risk-low)";
}

export default function Inventory() {
  const toast = useToast();
  const [batches, setBatches]       = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [filter, setFilter]         = useState("");
  const [form, setForm] = useState({
    supplier_id: "", produce_type: "", quantity_available: "",
    quality_grade: "A", asking_price: "", usable_until: "",
    min_sale_quantity: "10",
  });

  const load = useCallback(async () => {
    try {
      const [inv, sups] = await Promise.all([api.inventory(), api.suppliers()]);
      setBatches(inv);
      setSuppliers(sups);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createInventory({
        ...form,
        supplier_id: Number(form.supplier_id),
        quantity_available: Number(form.quantity_available),
        asking_price: Number(form.asking_price),
        min_sale_quantity: Number(form.min_sale_quantity),
      });
      toast("Inventory batch added!", "success");
      setShowModal(false);
      setForm({ supplier_id: "", produce_type: "", quantity_available: "", quality_grade: "A", asking_price: "", usable_until: "", min_sale_quantity: "10" });
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const filtered = batches.filter(
    (b) => b.produce_type.toLowerCase().includes(filter.toLowerCase())
  );

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
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Inventory Management</h2>
          <p className="text-muted text-sm" style={{ marginTop: 2 }}>
            {batches.length} active batches across {suppliers.length} suppliers
          </p>
        </div>
        <div className="flex gap-3">
          <input
            className="input-field"
            style={{ width: 200 }}
            placeholder="Search produce…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Add Batch
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-wrapper">
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No inventory batches found</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Produce</th><th>Supplier</th>
                  <th>Available</th><th>Reserved</th>
                  <th>Grade</th><th>Price/kg</th>
                  <th>Freshness</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const h = hoursLeft(b.usable_until);
                  const col = freshnessColor(h);
                  const supName = suppliers.find((s) => s.id === b.supplier_id)?.name ?? `Sup #${b.supplier_id}`;
                  return (
                    <tr key={b.id}>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>#{b.id}</td>
                      <td style={{ fontWeight: 600 }}>{b.produce_type}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{supName}</td>
                      <td><strong>{fmt(b.quantity_available)}</strong> {b.unit}</td>
                      <td style={{ color: "var(--text-muted)" }}>{fmt(b.quantity_reserved)} {b.unit}</td>
                      <td><span className={`badge ${GRADE_BADGE[b.quality_grade] ?? "badge-muted"}`}>{b.quality_grade}</span></td>
                      <td style={{ color: "var(--lime)", fontWeight: 600 }}>{fmtInr(b.asking_price)}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="freshness-bar-wrap">
                          <div className="freshness-bar" style={{ flex: 1 }}>
                            <div className="freshness-fill"
                              style={{
                                width: `${Math.min(100, (h / 168) * 100)}%`,
                                background: col,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {h.toFixed(0)} h
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[b.status] ?? "badge-muted"}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Inventory Batch</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Supplier</label>
                    <select className="input-field" required value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                      <option value="">Select supplier…</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Produce Type</label>
                    <input className="input-field" required placeholder="e.g. Tomatoes"
                      value={form.produce_type} onChange={(e) => setForm({ ...form, produce_type: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Available Quantity (kg)</label>
                    <input className="input-field" type="number" required min="1"
                      value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Quality Grade</label>
                    <select className="input-field" value={form.quality_grade}
                      onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}>
                      <option value="A">Grade A</option>
                      <option value="B">Grade B</option>
                      <option value="C">Grade C</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Asking Price (₹/kg)</label>
                    <input className="input-field" type="number" required min="1"
                      value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Min. Sale Quantity (kg)</label>
                    <input className="input-field" type="number" required min="1"
                      value={form.min_sale_quantity} onChange={(e) => setForm({ ...form, min_sale_quantity: e.target.value })} />
                  </div>
                  <div className="form-group form-full">
                    <label>Usable Until (simulation label)</label>
                    <input className="input-field" type="datetime-local" required
                      value={form.usable_until} onChange={(e) => setForm({ ...form, usable_until: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
