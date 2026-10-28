import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Leaf,
  Store,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Clock,
  Truck,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Globe2,
  Zap,
} from "lucide-react";

export default function LandingPage({ onNavigate }) {
  const { openLogin } = useAuth();
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.overview().then(setOverview).catch(() => {});
  }, []);

  return (
    <div className="landing-container" style={{ paddingBottom: 60 }}>
      {/* ── Hero Section ── */}
      <section
        className="glass-card"
        style={{
          padding: "54px 40px",
          marginBottom: 32,
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(247,243,236,0.85) 100%)",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <div
            className="badge badge-lite-green"
            style={{
              marginBottom: 18,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              display: "inline-flex",
            }}
          >
            <Sparkles size={14} />
            MANDIPULSE AI · AGENTIC SURPLUS COORDINATION MESH
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px, 4.5vw, 54px)",
              fontWeight: 700,
              lineHeight: 1.15,
              color: "var(--cream)",
              letterSpacing: "-0.02em",
              marginBottom: 18,
            }}
          >
            Stop Farmgate Produce Loss{" "}
            <span style={{ color: "var(--burgundy)", fontStyle: "italic" }}>
              Before The Clock Runs Out.
            </span>
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 1.8vw, 17px)",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxWidth: 720,
              margin: "0 auto 32px auto",
            }}
          >
            Over <strong>₹92,000 Crore</strong> of harvest-ready produce rots in Indian mandis every year,
            while commercial kitchens and retailers overpay. <strong>MandiPulse AI</strong> deploys autonomous
            agentic workflows to discover, match, and route perishable surplus to verified bulk buyers in minutes.
          </p>

          {/* Primary Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 40,
            }}
          >
            <button
              className="btn btn-primary"
              style={{
                padding: "13px 26px",
                fontSize: 14,
                borderRadius: 24,
                background: "linear-gradient(135deg, var(--lite-green-rich) 0%, var(--lite-green) 100%)",
                borderColor: "var(--lite-green-border)",
                boxShadow: "0 6px 20px rgba(31, 122, 77, 0.28)",
              }}
              onClick={() => onNavigate("seller")}
            >
              <Store size={18} />
              <span>I Want to Sell (Farmer Portal)</span>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-primary"
              style={{
                padding: "13px 26px",
                fontSize: 14,
                borderRadius: 24,
                background: "linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-bright) 100%)",
                boxShadow: "0 6px 20px rgba(122, 46, 57, 0.28)",
              }}
              onClick={() => onNavigate("buyer")}
            >
              <ShoppingBag size={18} />
              <span>I Want to Buy (Wholesale Portal)</span>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-ghost"
              style={{
                padding: "13px 22px",
                fontSize: 14,
                borderRadius: 24,
              }}
              onClick={() => onNavigate("dashboard")}
            >
              <Zap size={16} style={{ color: "var(--burgundy)" }} />
              <span>AI Orchestrator Engine</span>
            </button>
          </div>

          {/* Live Data Ticker */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              padding: "18px 24px",
              background: "rgba(255, 255, 255, 0.7)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>
                Total Produce Listed
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--cream)" }}>
                {overview?.food_impact?.total_kg_listed ? `${overview.food_impact.total_kg_listed.toLocaleString()} kg` : "3,250 kg"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>
                Gross Value Balanced
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--lite-green)" }}>
                {overview?.financials?.gross_transaction_value_inr
                  ? `₹${Math.round(overview.financials.gross_transaction_value_inr).toLocaleString()}`
                  : "₹74,200"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>
                Active Corridors
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--cream)" }}>
                Nashik · Pune · Mumbai · Agra
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>
                Autonomous Execution
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--dusty-pink)" }}>
                100% Deterministic Rules
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 1: Why We Built MandiPulse (The Problem) ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="badge badge-orange" style={{ marginBottom: 8 }}>
            <AlertTriangle size={13} />
            THE ROOT CHALLENGE
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--cream)" }}>
            Why Did We Build MandiPulse?
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 640, margin: "0 auto", fontSize: 14 }}>
            India is the world's 2nd largest producer of fruits & vegetables, yet nearly 16% is discarded before it reaches a plate.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--r-sm)",
                background: "var(--red-dim)",
                color: "var(--red)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Clock size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--cream)", marginBottom: 8 }}>
              The 24-Hour Perishability Window
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              High-moisture crops like tomatoes, coriander, and spinach degrade within 24 to 48 hours post-harvest.
              Traditional supply chains take 3-5 days of multi-tier middlemen, causing severe spoilage and value destruction.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--r-sm)",
                background: "var(--orange-dim)",
                color: "var(--orange)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <TrendingUp size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--cream)", marginBottom: 8 }}>
              Mandi Gluts & Distress Dumping
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              When harvesting peaks arrive simultaneously, local mandis face severe oversupply.
              Prices collapse to ₹2/kg, forcing farmers to abandon produce on roads while city kitchens 50 km away buy at ₹35/kg.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--r-sm)",
                background: "var(--dusty-pink-dim)",
                color: "var(--dusty-pink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Truck size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--cream)", marginBottom: 8 }}>
              The Missing Dynamic Cold-Chain
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              Smallholder farmers and local mandis cannot hire large logistics fleets on short notice.
              Without an automated system to check vehicle availability and route efficiency in real time, produce sits idle and decays.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: What We Are Solving ── */}
      <section
        className="glass-card"
        style={{
          padding: 36,
          marginBottom: 40,
          background: "linear-gradient(135deg, rgba(247,244,238,0.95) 0%, rgba(255,255,255,0.95) 100%)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="badge badge-lite-green" style={{ marginBottom: 8 }}>
            <Globe2 size={13} />
            MEASURABLE IMPACT
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--cream)" }}>
            What We Are Solving
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 640, margin: "0 auto", fontSize: 14 }}>
            Aligning national food security with global United Nations Sustainable Development Goals.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--lite-green-dim)",
                color: "var(--lite-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 4 }}>
                SDG 12.3 · Halving Food Loss
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                Targeting zero edible food dumped. Every kilogram matched and moved before its shelf-life expires directly eliminates post-harvest agricultural waste.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--lite-green-dim)",
                color: "var(--lite-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 4 }}>
                SDG 2 · Zero Hunger & Fair Proceeds
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                Guaranteeing farmgate price realization. Farmers receive direct proceeds above distress dump rates, while institutional kitchens receive affordable nutrition.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--lite-green-dim)",
                color: "var(--lite-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 4 }}>
                Algorithmic Fairness & Transparency
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                Zero hidden commissions. Fixed 2% platform fee, transparent transport cost deductions, and verified quality grade matching.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: How the AI Agent Works ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="badge badge-dusty-pink" style={{ marginBottom: 8 }}>
            <Sparkles size={13} />
            AGENTIC INTELLIGENCE ARCHITECTURE
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--cream)" }}>
            How MandiPulse AI Coordinates The Mesh
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 640, margin: "0 auto", fontSize: 14 }}>
            Deterministic backend rules + autonomous n8n agent reasoning ensure 100% operational safety.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            {
              step: "01",
              title: "Surplus Listing",
              desc: "Farmer lists produce with quantity, grade, asking price, and usable-until expiry countdown.",
              icon: Boxes,
              color: "var(--lite-green)",
            },
            {
              step: "02",
              title: "Agent Reasoning",
              desc: "AI Agent calls tools to fetch open buyer demands, checking price ceilings and grade suitability.",
              icon: Sparkles,
              color: "var(--burgundy)",
            },
            {
              step: "03",
              title: "Logistics Check",
              desc: "Agent checks active vehicle fleet, verifying ETA will reach before produce freshness expires.",
              icon: Truck,
              color: "var(--dusty-pink)",
            },
            {
              step: "04",
              title: "Approval & Recovery",
              desc: "Proposals sent to buyers for approval. If a vehicle breaks down, the agent autonomously replans.",
              icon: ShieldCheck,
              color: "var(--orange)",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="glass-card" style={{ padding: 22 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: item.color,
                    }}
                  >
                    {item.step}
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-sm)",
                      background: "rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: item.color,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 6 }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 4: Choose Your Portal (Two Dedicated Dashboards) ── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--cream)" }}>
            Choose Your Dedicated Portal
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Two distinct, tailored interfaces designed for suppliers and buyers.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {/* Seller Card */}
          <div
            className="glass-card"
            style={{
              padding: 30,
              border: "1.5px solid var(--lite-green-border)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(240,250,244,0.7) 100%)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--r-md)",
                background: "var(--lite-green-dim)",
                color: "var(--lite-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <Store size={26} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 8 }}>
              For Farmers, FPOs & Mandi Sellers
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              List distress surplus in 30 seconds before it rots. Receive verified match proposals, view real-time transport dispatches, and track earnings with transparent deductions.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--lite-green)" }} />
                <span>Instant Surplus Produce Listing</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--lite-green)" }} />
                <span>Automated Expiry & Shelf-Life Countdown</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--lite-green)" }} />
                <span>Transparent Net Proceeds Breakdown</span>
              </li>
            </ul>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: "var(--lite-green)",
                  borderColor: "var(--lite-green-border)",
                }}
                onClick={() => onNavigate("seller")}
              >
                <span>Launch Seller Dashboard</span>
                <ArrowRight size={15} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => openLogin("seller")}
              >
                <span>Switch Seller Account</span>
              </button>
            </div>
          </div>

          {/* Buyer Card */}
          <div
            className="glass-card"
            style={{
              padding: 30,
              border: "1.5px solid var(--dusty-pink-border)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(250,240,244,0.7) 100%)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--r-md)",
                background: "var(--burgundy-dim)",
                color: "var(--burgundy)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <ShoppingBag size={26} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--cream)", marginBottom: 8 }}>
              For Retailers, Kitchens & Wholesalers
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Post bulk requirements with max price ceilings. Review AI-curated surplus proposals, approve orders with 1-click, and track cold-chain delivery vehicle dispatch in real time.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--burgundy)" }} />
                <span>Upload Buy Requirements & Price Ceilings</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--burgundy)" }} >
                <CheckCircle2 size={16} style={{ color: "var(--burgundy)" }} />
                <span>1-Click Match Proposal Approval & Escrow</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--burgundy)" }} >
                <CheckCircle2 size={16} style={{ color: "var(--burgundy)" }} />
                <span>Live Fleet & Order Tracking</span>
              </li>
            </ul>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: "var(--burgundy)",
                }}
                onClick={() => onNavigate("buyer")}
              >
                <span>Launch Buyer Dashboard</span>
                <ArrowRight size={15} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => openLogin("buyer")}
              >
                <span>Switch Buyer Account</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
