import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useToast } from "./Toast";
import { X, UserCheck, Plus, Store, ShoppingBag, MapPin, Phone } from "lucide-react";

export default function LoginModal() {
  const {
    showLoginModal,
    closeLogin,
    loginModalRole,
    setLoginModalRole,
    suppliers,
    buyers,
    loginAsSeller,
    loginAsBuyer,
    sellerUser,
    buyerUser,
    refreshUsers,
  } = useAuth();
  const toast = useToast();

  const [isRegistering, setIsRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Supplier form state
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact: "",
    location: "Nashik, MH",
    lat: 19.9975,
    lng: 73.7898,
  });

  // New Buyer form state
  const [newBuyer, setNewBuyer] = useState({
    name: "",
    buyer_type: "kitchen",
    contact: "",
    location: "Mumbai, MH",
    lat: 19.076,
    lng: 72.8777,
  });

  if (!showLoginModal) return null;

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (loginModalRole === "seller") {
        const created = await api.createSupplier(newSupplier);
        await refreshUsers();
        loginAsSeller(created);
        toast(`Registered & logged in as ${created.name}`, "success");
      } else {
        const created = await api.createBuyer(newBuyer);
        await refreshUsers();
        loginAsBuyer(created);
        toast(`Registered & logged in as ${created.name}`, "success");
      }
      setIsRegistering(false);
    } catch (err) {
      toast(err.message || "Registration failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeLogin}>
      <div
        className="modal-box glass-card"
        style={{ maxWidth: 540, width: "95%", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="card-header" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {loginModalRole === "seller" ? (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-sm)",
                  background: "var(--lite-green-dim)",
                  color: "var(--lite-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Store size={18} />
              </div>
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-sm)",
                  background: "var(--burgundy-dim)",
                  color: "var(--burgundy)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingBag size={18} />
              </div>
            )}
            <div>
              <h2 style={{ fontSize: 17, margin: 0 }}>
                {loginModalRole === "seller" ? "Seller / Farmer Access" : "Institutional Buyer Access"}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-subtle)" }}>
                {isRegistering
                  ? "Register a new entity on MandiPulse"
                  : "Select an active account or create a new profile"}
              </p>
            </div>
          </div>
          <button className="btn-ghost" style={{ padding: 6 }} onClick={closeLogin}>
            <X size={16} />
          </button>
        </div>

        {/* Role Switcher Tabs */}
        <div
          style={{
            display: "flex",
            background: "rgba(240, 234, 224, 0.6)",
            padding: "4px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            gap: 8,
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${loginModalRole === "seller" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, borderRadius: 20 }}
            onClick={() => {
              setLoginModalRole("seller");
              setIsRegistering(false);
            }}
          >
            <Store size={14} />
            <span>I want to Sell (Farmer/Mandi)</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${loginModalRole === "buyer" ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, borderRadius: 20 }}
            onClick={() => {
              setLoginModalRole("buyer");
              setIsRegistering(false);
            }}
          >
            <ShoppingBag size={14} />
            <span>I want to Buy (Wholesale/Kitchen)</span>
          </button>
        </div>

        <div className="card-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {!isRegistering ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-subtle)",
                  }}
                >
                  {loginModalRole === "seller" ? "Active Suppliers / Mandis" : "Active Commercial Buyers"}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={() => setIsRegistering(true)}
                >
                  <Plus size={13} />
                  <span>Register New</span>
                </button>
              </div>

              {loginModalRole === "seller" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {suppliers.map((s) => {
                    const isSelected = sellerUser?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        className="glass-card"
                        style={{
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          border: isSelected
                            ? "1.5px solid var(--lite-green)"
                            : "1px solid var(--border-subtle)",
                          background: isSelected ? "var(--lite-green-dim)" : "var(--bg-card)",
                        }}
                        onClick={() => loginAsSeller(s)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cream)" }}>
                            {s.name}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              fontSize: 12,
                              color: "var(--text-subtle)",
                              marginTop: 3,
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={12} /> {s.location}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Phone size={12} /> {s.contact || "Verified"}
                            </span>
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-ghost"}`}
                          style={{
                            background: isSelected ? "var(--lite-green)" : undefined,
                            borderColor: isSelected ? "var(--lite-green)" : undefined,
                          }}
                        >
                          <UserCheck size={14} />
                          <span>{isSelected ? "Active" : "Select"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {buyers.map((b) => {
                    const isSelected = buyerUser?.id === b.id;
                    return (
                      <div
                        key={b.id}
                        className="glass-card"
                        style={{
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          border: isSelected
                            ? "1.5px solid var(--burgundy)"
                            : "1px solid var(--border-subtle)",
                          background: isSelected ? "var(--burgundy-dim)" : "var(--bg-card)",
                        }}
                        onClick={() => loginAsBuyer(b)}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontWeight: 600,
                              fontSize: 14,
                              color: "var(--cream)",
                            }}
                          >
                            {b.name}
                            <span
                              className="badge badge-muted"
                              style={{ fontSize: 10, padding: "1px 7px" }}
                            >
                              {b.buyer_type}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              fontSize: 12,
                              color: "var(--text-subtle)",
                              marginTop: 3,
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={12} /> {b.location}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Phone size={12} /> {b.contact || "Verified"}
                            </span>
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-ghost"}`}
                          style={{
                            background: isSelected ? "var(--burgundy)" : undefined,
                            borderColor: isSelected ? "var(--burgundy)" : undefined,
                          }}
                        >
                          <UserCheck size={14} />
                          <span>{isSelected ? "Active" : "Select"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>
                  {loginModalRole === "seller" ? "Register New Farmer / Mandi" : "Register New Wholesale Buyer"}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsRegistering(false)}
                >
                  Back to List
                </button>
              </div>

              {loginModalRole === "seller" ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Farm / Producer / Mandi Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Kisan Sahakari Farm"
                      required
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Mandi Location *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Nashik, MH"
                        required
                        value={newSupplier.location}
                        onChange={(e) => setNewSupplier({ ...newSupplier, location: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact / Phone *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="+91-98765-43210"
                        required
                        value={newSupplier.contact}
                        onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Buyer / Business Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Taj Hotel Central Kitchen"
                      required
                      value={newBuyer.name}
                      onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })}
                    />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Buyer Type</label>
                      <select
                        className="form-select"
                        value={newBuyer.buyer_type}
                        onChange={(e) => setNewBuyer({ ...newBuyer, buyer_type: e.target.value })}
                      >
                        <option value="kitchen">Commercial Kitchen / Canteen</option>
                        <option value="retailer">Retail Supermarket / Grocery</option>
                        <option value="wholesaler">Bulk Wholesaler / Distributor</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Delivery Location *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Powai, Mumbai"
                        required
                        value={newBuyer.location}
                        onChange={(e) => setNewBuyer({ ...newBuyer, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone / WhatsApp</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+91-98100-12345"
                      value={newBuyer.contact}
                      onChange={(e) => setNewBuyer({ ...newBuyer, contact: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={submitting}
              >
                {submitting ? "Registering..." : "Create Account & Continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
