import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem("mandipulse_role") || "seller");
  const [sellerUser, setSellerUser] = useState(() => {
    try {
      const saved = localStorage.getItem("mandipulse_seller");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [buyerUser, setBuyerUser] = useState(() => {
    try {
      const saved = localStorage.getItem("mandipulse_buyer");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [suppliers, setSuppliers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalRole, setLoginModalRole] = useState("seller");

  // Load available suppliers and buyers from backend
  const refreshUsers = async () => {
    try {
      const [sups, buys] = await Promise.all([api.suppliers(), api.buyers()]);
      setSuppliers(sups);
      setBuyers(buys);

      // If no active seller selected, default to first
      if (!sellerUser && sups.length > 0) {
        setSellerUser(sups[0]);
        localStorage.setItem("mandipulse_seller", JSON.stringify(sups[0]));
      } else if (sellerUser && sups.length > 0) {
        const found = sups.find((s) => s.id === sellerUser.id);
        if (found) setSellerUser(found);
      }

      // If no active buyer selected, default to first
      if (!buyerUser && buys.length > 0) {
        setBuyerUser(buys[0]);
        localStorage.setItem("mandipulse_buyer", JSON.stringify(buys[0]));
      } else if (buyerUser && buys.length > 0) {
        const found = buys.find((b) => b.id === buyerUser.id);
        if (found) setBuyerUser(found);
      }
    } catch (err) {
      console.error("Failed to load suppliers/buyers:", err);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const loginAsSeller = (supplier) => {
    setSellerUser(supplier);
    setRole("seller");
    localStorage.setItem("mandipulse_seller", JSON.stringify(supplier));
    localStorage.setItem("mandipulse_role", "seller");
    setShowLoginModal(false);
  };

  const loginAsBuyer = (buyer) => {
    setBuyerUser(buyer);
    setRole("buyer");
    localStorage.setItem("mandipulse_buyer", JSON.stringify(buyer));
    localStorage.setItem("mandipulse_role", "buyer");
    setShowLoginModal(false);
  };

  const openLogin = (targetRole = "seller") => {
    setLoginModalRole(targetRole);
    setShowLoginModal(true);
  };

  const closeLogin = () => {
    setShowLoginModal(false);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        sellerUser,
        buyerUser,
        suppliers,
        buyers,
        loginAsSeller,
        loginAsBuyer,
        openLogin,
        closeLogin,
        showLoginModal,
        loginModalRole,
        setLoginModalRole,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
