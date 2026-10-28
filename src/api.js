// Central API client – all fetch calls go through here
const BASE = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  // Core
  health:           ()            => request("/health"),
  agentCycle:       ()            => request("/agent/cycle", { method: "POST" }),
  agentEvents:      (limit = 50)  => request(`/agent/events?limit=${limit}`),

  // Analytics
  overview:         ()            => request("/analytics/overview"),

  // Suppliers
  suppliers:        ()            => request("/suppliers/"),
  createSupplier:   (body)        => request("/suppliers/", { method: "POST", body: JSON.stringify(body) }),

  // Buyers
  buyers:           ()            => request("/buyers/"),
  createBuyer:      (body)        => request("/buyers/", { method: "POST", body: JSON.stringify(body) }),

  // Inventory
  inventory:        ()            => request("/inventory/"),
  createInventory:  (body)        => request("/inventory/", { method: "POST", body: JSON.stringify(body) }),
  instantBuy:       (batchId, body) => request(`/inventory/${batchId}/instant-buy`, { method: "POST", body: JSON.stringify(body) }),
  atRisk:           ()            => request("/inventory/at-risk/list"),

  // Demands
  demands:          ()            => request("/demands/"),
  createDemand:     (body)        => request("/demands/", { method: "POST", body: JSON.stringify(body) }),
  cancelDemand:     (id)          => request(`/demands/${id}/cancel`, { method: "DELETE" }),
  autoProcure:      (buyerId)     => request(`/buyers/${buyerId}/auto-procure`, { method: "POST" }),

  // Vehicles
  vehicles:         ()            => request("/vehicles/"),
  createVehicle:    (body)        => request("/vehicles/", { method: "POST", body: JSON.stringify(body) }),
  vehicleUnavail:   (id)          => request(`/vehicles/${id}/unavailable`, { method: "POST" }),

  // Proposals & Matching
  proposals:        ()            => request("/proposals/"),
  refreshProposals: ()            => request("/proposals/refresh", { method: "POST" }),
  previewMatches:   (body)        => request("/api/matches/preview", { method: "POST", body: JSON.stringify(body) }),

  // Orders
  orders:           ()            => request("/orders/"),
  confirmOrder:     (proposalId)  => request("/orders/confirm", { method: "POST", body: JSON.stringify({ proposal_id: proposalId }) }),
  cancelOrder:      (id)          => request(`/orders/${id}/cancel`, { method: "POST" }),
  advanceOrder:     (id, status)  => request(`/orders/${id}/advance`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // n8n
  n8nStatus:        ()            => request("/api/n8n/status"),
};
