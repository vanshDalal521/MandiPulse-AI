import { useState } from "react";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginModal from "./components/LoginModal";
import LandingPage from "./pages/LandingPage";
import SellerDashboard from "./pages/SellerDashboard";
import BuyerDashboard from "./pages/BuyerDashboard";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Matching from "./pages/Matching";
import Logistics from "./pages/Logistics";
import Analytics from "./pages/Analytics";
import {
  LayoutDashboard,
  Boxes,
  GitCompareArrows,
  Truck,
  BarChart3,
  Leaf,
  Sparkles,
  Store,
  ShoppingBag,
  Globe2,
  User,
  ArrowRightLeft,
} from "lucide-react";

const NAV = [
  // Portals
  { id: "landing",   label: "Home & Mission",     icon: Globe2,           group: "PORTALS" },
  { id: "seller",    label: "Seller Hub (Farmer)", icon: Store,            group: "PORTALS", badge: "Sell" },
  { id: "buyer",     label: "Buyer Hub (Kitchen)", icon: ShoppingBag,      group: "PORTALS", badge: "Buy" },

  // AI Orchestrator
  { id: "dashboard", label: "Operations Overview", icon: LayoutDashboard,  group: "AI ORCHESTRATOR" },
  { id: "inventory", label: "Live Inventory",      icon: Boxes,            group: "AI ORCHESTRATOR" },
  { id: "matching",  label: "Matching Engine",     icon: GitCompareArrows, group: "AI ORCHESTRATOR" },
  { id: "logistics", label: "Fleet & Recovery",    icon: Truck,            group: "AI ORCHESTRATOR" },
  { id: "analytics", label: "SDG Economics",       icon: BarChart3,        group: "AI ORCHESTRATOR" },
];

const PAGES = {
  landing:   LandingPage,
  seller:    SellerDashboard,
  buyer:     BuyerDashboard,
  dashboard: Dashboard,
  inventory: Inventory,
  matching:  Matching,
  logistics: Logistics,
  analytics: Analytics,
};

const PAGE_META = {
  landing:   { title: "MandiPulse AI",             sub: "The Autonomous Agricultural Surplus Balancing Mesh" },
  seller:    { title: "Farmer & Supplier Portal",  sub: "List perishable surplus, review buyer matches & track dispatches" },
  buyer:     { title: "Wholesale Buyer Portal",    sub: "Upload buy demands, approve AI proposals & track cold-chain delivery" },
  dashboard: { title: "Operations Overview",       sub: "Live situational awareness & autonomous agentic balancing" },
  inventory: { title: "Inventory Intelligence",    sub: "Real-time surplus monitoring & shelf-life tracking" },
  matching:  { title: "Supply & Demand Matching",  sub: "Algorithmic multi-factor pairing & margin discovery" },
  logistics: { title: "Logistics & Fleet",         sub: "Cold-chain allocation, dispatch & recovery" },
  analytics: { title: "SDG Impact & Economics",    sub: "Waste reduction, recovered value & platform KPIs" },
};

function AppContent() {
  const [page, setPage] = useState("landing");
  const { role, sellerUser, buyerUser, openLogin } = useAuth();

  const Page = PAGES[page] ?? LandingPage;
  const meta = PAGE_META[page] || PAGE_META.landing;

  const groups = ["PORTALS", "AI ORCHESTRATOR"];

  // Helper to determine active entity badge
  let activeEntityLabel = "Select Account";
  let activeRoleColor = "var(--text-subtle)";
  let activeRoleBg = "rgba(0,0,0,0.05)";

  if (page === "seller" || (page !== "buyer" && role === "seller")) {
    activeEntityLabel = sellerUser ? `🌾 ${sellerUser.name}` : "Farmer Login";
    activeRoleColor = "var(--lite-green)";
    activeRoleBg = "var(--lite-green-dim)";
  } else if (page === "buyer" || role === "buyer") {
    activeEntityLabel = buyerUser ? `🛒 ${buyerUser.name}` : "Buyer Login";
    activeRoleColor = "var(--burgundy)";
    activeRoleBg = "var(--burgundy-dim)";
  }

  return (
    <>
      <LoginModal />

      {/* Ambient background blur mesh */}
      <div className="bg-canvas" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="app-shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar" role="navigation" aria-label="Main navigation">
          <div
            className="sidebar-logo"
            style={{ cursor: "pointer" }}
            onClick={() => setPage("landing")}
          >
            <div className="logo-mark" aria-hidden="true" style={{ color: "var(--lite-green)" }}>
              <Leaf size={18} />
            </div>
            <div className="logo-text">
              Mandi<span>Pulse</span>
            </div>
          </div>

          {groups.map((group) => {
            const items = NAV.filter((n) => n.group === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 14 }}>
                <div className="nav-group-label">{group}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = page === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={() => setPage(item.id)}
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        position: "relative",
                        color:
                          item.id === "seller" && isActive
                            ? "var(--lite-green)"
                            : item.id === "buyer" && isActive
                            ? "var(--burgundy)"
                            : undefined,
                      }}
                    >
                      <Icon size={16} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span
                          className={`badge ${
                            item.badge === "Sell" ? "badge-lite-green" : "badge-dusty-pink"
                          }`}
                          style={{ fontSize: 9.5, padding: "1px 6px" }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="sidebar-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Sparkles size={13} style={{ color: "var(--lite-green)" }} />
              <strong style={{ color: "var(--cream)", fontSize: 12 }}>MandiPulse AI</strong>
            </div>
            <span style={{ color: "var(--lite-green)", fontWeight: 600, display: "inline-block", marginBottom: 2 }}>
              SDG 2 · Zero Hunger
            </span>
            <br />
            <span style={{ color: "var(--dusty-pink)", fontWeight: 500 }}>
              SDG 12 · Responsible Consumption
            </span>
          </div>
        </aside>

        {/* ── Main Canvas ── */}
        <div className="main-area">
          {/* Topbar */}
          <header className="topbar" role="banner">
            <div className="topbar-left">
              <h1>{meta.title}</h1>
              <p>{meta.sub}</p>
            </div>

            <div className="topbar-right" style={{ gap: 12 }}>
              {/* Quick Navigation Pills */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: "rgba(240, 234, 224, 0.6)",
                  padding: "4px 8px",
                  borderRadius: 24,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  className={`btn btn-sm ${page === "landing" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 11.5,
                  }}
                  onClick={() => setPage("landing")}
                >
                  <Globe2 size={13} />
                  <span>Home</span>
                </button>
                <button
                  className={`btn btn-sm ${page === "seller" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 11.5,
                    background: page === "seller" ? "var(--lite-green)" : undefined,
                    borderColor: page === "seller" ? "var(--lite-green-border)" : undefined,
                  }}
                  onClick={() => setPage("seller")}
                >
                  <Store size={13} />
                  <span>Seller Portal</span>
                </button>
                <button
                  className={`btn btn-sm ${page === "buyer" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 11.5,
                    background: page === "buyer" ? "var(--burgundy)" : undefined,
                  }}
                  onClick={() => setPage("buyer")}
                >
                  <ShoppingBag size={13} />
                  <span>Buyer Portal</span>
                </button>
                <button
                  className={`btn btn-sm ${page === "dashboard" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 11.5,
                  }}
                  onClick={() => setPage("dashboard")}
                >
                  <Sparkles size={13} />
                  <span>Orchestrator</span>
                </button>
              </div>

              {/* Active User Account Switcher Button */}
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: activeRoleBg,
                  color: activeRoleColor,
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontWeight: 600,
                  fontSize: 12,
                }}
                onClick={() => openLogin(page === "buyer" ? "buyer" : "seller")}
                title="Click to switch or register profile"
              >
                <User size={13} />
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeEntityLabel}
                </span>
                <ArrowRightLeft size={12} style={{ opacity: 0.7 }} />
              </button>

              <div
                className="live-badge"
                style={{
                  background: "var(--lite-green-dim)",
                  borderColor: "var(--lite-green-border)",
                  color: "var(--lite-green)",
                }}
              >
                <span
                  className="live-badge-dot"
                  style={{
                    background: "var(--lite-green)",
                    boxShadow: "0 0 10px var(--lite-green)",
                  }}
                />
                AUTONOMOUS MESH ACTIVE
              </div>
            </div>
          </header>

          {/* Page Content Viewport */}
          <main className="page-content" id="main-content">
            <Page onNavigate={setPage} />
          </main>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
