"""
MandiPulse AI – Agentic Matching & Logistics Engine

Contains:
  - distance / ETA helpers (simulated)
  - InventoryAgent  – finds at-risk surplus
  - MatchingAgent   – scores and ranks feasible supply-demand pairs
  - LogisticsAgent  – assigns vehicles and calculates ETA
  - RecoveryAgent   – replans when disruptions occur
  - CoordinatorAgent – orchestrates the above
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from sqlmodel import Session, select

from .models import (
    InventoryBatch, DemandRequest, MatchProposal, Order,
    Vehicle, Supplier, Buyer, AgentEvent,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PLATFORM_FEE_RATE = 0.02          # 2% of gross sale value
AVG_SPEED_KM_PER_H = 50           # assumed average road speed
LOADING_BUFFER_H = 0.5            # loading / unloading time in hours
FRESHNESS_RISK_THRESHOLD_H = 6    # hours left → "critical"
FRESHNESS_WARN_THRESHOLD_H = 24   # hours left → "urgent"


# ---------------------------------------------------------------------------
# Geo helpers (Haversine)
# ---------------------------------------------------------------------------
def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in km between two lat/lng points."""
    R = 6371  # Earth radius km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_eta(distance_km: float) -> timedelta:
    """Return estimated travel time including loading buffer."""
    travel_h = distance_km / AVG_SPEED_KM_PER_H + LOADING_BUFFER_H
    return timedelta(hours=travel_h)


def transport_cost(distance_km: float, cost_per_km: float) -> float:
    return round(distance_km * cost_per_km, 2)


def _log(db: Session, event_type: str, agent: str, summary: str,
         entity_id: Optional[int] = None, entity_type: Optional[str] = None,
         prev: Optional[str] = None, nxt: Optional[str] = None, reason: Optional[str] = None):
    ev = AgentEvent(
        event_type=event_type, agent=agent, summary=summary,
        entity_id=entity_id, entity_type=entity_type,
        previous_state=prev, new_state=nxt, reason=reason,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


# ---------------------------------------------------------------------------
# Inventory Agent
# ---------------------------------------------------------------------------
class InventoryAgent:
    """Scans available batches and flags at-risk inventory."""

    @staticmethod
    def get_at_risk(db: Session) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        batches = db.exec(
            select(InventoryBatch).where(InventoryBatch.status == "available")
        ).all()

        at_risk = []
        for b in batches:
            remaining_h = (b.usable_until - now).total_seconds() / 3600
            if remaining_h <= 0:
                risk = "expired"
            elif remaining_h <= FRESHNESS_RISK_THRESHOLD_H:
                risk = "critical"
            elif remaining_h <= FRESHNESS_WARN_THRESHOLD_H:
                risk = "urgent"
            else:
                risk = "low"

            if risk in ("critical", "urgent", "expired"):
                at_risk.append({
                    "batch": b,
                    "batch_id": b.id,
                    "produce_type": b.produce_type,
                    "quantity_available": b.quantity_available,
                    "asking_price": b.asking_price,
                    "quality_grade": b.quality_grade,
                    "risk_level": risk,
                    "hours_remaining": max(0, remaining_h),
                    "value_at_risk": round(b.quantity_available * b.asking_price, 2),
                })

        # Sort by urgency (critical first, then urgent)
        order_map = {"expired": 0, "critical": 1, "urgent": 2}
        at_risk.sort(key=lambda x: order_map.get(x["risk_level"], 99))
        return at_risk

    @staticmethod
    def mark_expired(db: Session):
        """Auto-expire batches whose usable_until has passed."""
        now = datetime.now(timezone.utc)
        batches = db.exec(
            select(InventoryBatch).where(
                InventoryBatch.status == "available",
                InventoryBatch.usable_until <= now,
            )
        ).all()
        for b in batches:
            prev = b.status
            b.status = "expired"
            db.add(b)
            _log(db, "batch_expired", "inventory", f"Batch {b.id} ({b.produce_type}) expired",
                 entity_id=b.id, entity_type="batch", prev=prev, nxt="expired")
        if batches:
            db.commit()
        return len(batches)


# ---------------------------------------------------------------------------
# Matching Agent
# ---------------------------------------------------------------------------
class MatchingAgent:
    """Generates ranked, feasible match proposals."""

    @staticmethod
    def _freshness_score(batch: InventoryBatch, demand: DemandRequest) -> float:
        """Higher score = more urgent (reward matching urgent produce first)."""
        now = datetime.now(timezone.utc)
        hours_left = (batch.usable_until - now).total_seconds() / 3600
        if hours_left <= 0:
            return 0.0
        return min(1.0, 1 - (hours_left / 168))  # normalise to ~1 week

    @staticmethod
    def _value_score(batch: InventoryBatch, demand: DemandRequest) -> float:
        """Reward higher gross value (price × qty)."""
        qty = min(batch.quantity_available, demand.quantity_required)
        gross = qty * batch.asking_price
        return min(1.0, gross / 50000)  # normalise to ₹50k

    @staticmethod
    def _transport_efficiency(distance_km: float) -> float:
        """Shorter distance → higher score."""
        return max(0.0, 1 - (distance_km / 500))

    @staticmethod
    def _compatibility(batch: InventoryBatch, demand: DemandRequest) -> bool:
        acceptable_grades = [g.strip() for g in demand.quality_requirement.split(",")]
        if batch.quality_grade not in acceptable_grades:
            return False
        if batch.asking_price > demand.maximum_price:
            return False
        if batch.produce_type != demand.produce_type:
            return False
        qty = min(batch.quantity_available, demand.quantity_required)
        if qty < batch.min_sale_quantity:
            return False
        return True

    @classmethod
    def run(
        cls,
        db: Session,
        persist: bool = True,
    ) -> List[MatchProposal]:
        """
        Multi-buyer batch splitting:
        For each available batch, distribute its quantity across ALL compatible
        open demands proportionally (or equally when demands are equal).
        A 500 kg batch with two 250 kg demands → 250 kg proposal to each buyer.
        Returns proposals sorted by score descending.
        """
        now = datetime.now(timezone.utc)

        batches = db.exec(
            select(InventoryBatch).where(
                InventoryBatch.status == "available",
                InventoryBatch.usable_until > now,
            )
        ).all()
        demands = db.exec(
            select(DemandRequest).where(DemandRequest.status.in_(["open", "partially_fulfilled"]))
        ).all()

        suppliers = {s.id: s for s in db.exec(select(Supplier)).all()}
        buyers = {b.id: b for b in db.exec(select(Buyer)).all()}
        vehicles = db.exec(select(Vehicle).where(Vehicle.status == "available")).all()

        results: List[MatchProposal] = []

        # Load already-pending (batch_id, demand_id) pairs to avoid duplicates
        existing_pairs = set(
            (p.batch_id, p.demand_id)
            for p in db.exec(
                select(MatchProposal).where(MatchProposal.status == "pending")
            ).all()
        )


        for batch in batches:
            sup = suppliers.get(batch.supplier_id)
            # Track how much of THIS batch is still unallocated in this run
            remaining_batch_qty = batch.quantity_available

            # First pass: collect all feasible demands and their weights
            feasible: List[Dict[str, Any]] = []
            for demand in demands:
                # Skip if we already have a pending proposal for this pair
                if (batch.id, demand.id) in existing_pairs:
                    continue
                unfilled = demand.quantity_required - demand.quantity_fulfilled
                if unfilled <= 0:
                    continue
                if not cls._compatibility(batch, demand):
                    continue

                buy = buyers.get(demand.buyer_id)
                dist = 80.0
                if sup and buy and sup.lat and buy.lat:
                    dist = _haversine(sup.lat, sup.lng, buy.lat, buy.lng)

                best_vehicle = None
                for v in vehicles:
                    if v.capacity_kg >= min(remaining_batch_qty, unfilled):
                        if best_vehicle is None or v.cost_per_km < best_vehicle.cost_per_km:
                            best_vehicle = v
                if not best_vehicle:
                    continue

                eta_td = estimate_eta(dist)
                estimated_arrival = now + eta_td
                if estimated_arrival > batch.usable_until:
                    continue
                if estimated_arrival > demand.delivery_deadline:
                    continue

                feasible.append({
                    "demand": demand,
                    "unfilled": unfilled,
                    "dist": dist,
                    "best_vehicle": best_vehicle,
                    "buy": buy,
                })

            if not feasible:

                continue

            # Second pass: split batch across feasible demands proportionally
            # Each demand gets: (its_unfilled / total_unfilled) * batch_qty — capped at its own unfilled
            total_unfilled = sum(f["unfilled"] for f in feasible)
            for f in feasible:
                if remaining_batch_qty <= 0:
                    break
                demand = f["demand"]
                # Proportional share of this batch for this buyer
                share = (f["unfilled"] / total_unfilled) * batch.quantity_available
                # Capped at what they actually need and what's left in the batch
                qty = round(min(share, f["unfilled"], remaining_batch_qty), 2)
                if qty < batch.min_sale_quantity:
                    continue

                remaining_batch_qty -= qty

                dist = f["dist"]
                best_vehicle = f["best_vehicle"]
                t_cost = transport_cost(dist, best_vehicle.cost_per_km)
                gross = round(qty * batch.asking_price, 2)
                fee = round(gross * PLATFORM_FEE_RATE, 2)
                proceeds = round(gross - t_cost - fee, 2)

                score = (
                    0.30 * cls._freshness_score(batch, demand)
                    + 0.25 * cls._value_score(batch, demand)
                    + 0.25 * cls._transport_efficiency(dist)
                    + 0.20 * min(1.0, qty / demand.quantity_required)
                )

                proposal = MatchProposal(
                    batch_id=batch.id,
                    demand_id=demand.id,
                    proposed_quantity=qty,
                    proposed_price=batch.asking_price,
                    estimated_transport_cost=t_cost,
                    platform_fee=fee,
                    supplier_proceeds=proceeds,
                    score=round(score, 4),
                    status="pending",
                )

                if persist:
                    db.add(proposal)
                    db.commit()
                    db.refresh(proposal)
                    pct = round(qty / batch.quantity_available * 100)
                    buyer_name = f["buy"].name if f["buy"] else f"Buyer {demand.buyer_id}"
                    _log(
                        db, "match_found", "matching",
                        f"[SPLIT] {batch.produce_type} {qty}kg ({pct}% of batch) → {buyer_name} "
                        f"(score {score:.2f}, {len(feasible)} buyers sharing this batch)",
                        entity_id=proposal.id, entity_type="proposal", nxt="pending",
                    )

                results.append(proposal)

        results.sort(key=lambda p: p.score, reverse=True)
        return results

    @classmethod
    def run_for_batch(
        cls,
        db: Session,
        batch_id: int,
        persist: bool = True,
    ) -> List[MatchProposal]:
        """
        Run matching for a single batch only (called immediately when inventory is created).
        Splits the batch across all eligible open demands proportionally.
        """
        now = datetime.now(timezone.utc)
        batch = db.get(InventoryBatch, batch_id)
        if not batch or batch.status != "available" or batch.usable_until <= now:
            return []

        demands = db.exec(
            select(DemandRequest).where(DemandRequest.status.in_(["open", "partially_fulfilled"]))
        ).all()
        suppliers = {s.id: s for s in db.exec(select(Supplier)).all()}
        buyers = {b.id: b for b in db.exec(select(Buyer)).all()}
        vehicles = db.exec(select(Vehicle).where(Vehicle.status == "available")).all()

        sup = suppliers.get(batch.supplier_id)
        remaining_batch_qty = batch.quantity_available
        feasible: List[Dict[str, Any]] = []

        # Load already-pending proposals for this batch to avoid duplicates
        existing_demand_ids = set(
            p.demand_id for p in db.exec(
                select(MatchProposal).where(
                    MatchProposal.batch_id == batch_id,
                    MatchProposal.status == "pending",
                )
            ).all()
        )

        for demand in demands:
            # Skip pairs already proposed
            if demand.id in existing_demand_ids:
                continue
            unfilled = demand.quantity_required - demand.quantity_fulfilled
            if unfilled <= 0:
                continue
            if not cls._compatibility(batch, demand):
                continue
            buy = buyers.get(demand.buyer_id)
            dist = 80.0
            if sup and buy and sup.lat and buy.lat:
                dist = _haversine(sup.lat, sup.lng, buy.lat, buy.lng)
            best_vehicle = None
            for v in vehicles:
                if v.capacity_kg >= min(remaining_batch_qty, unfilled):
                    if best_vehicle is None or v.cost_per_km < best_vehicle.cost_per_km:
                        best_vehicle = v
            if not best_vehicle:
                continue
            eta_td = estimate_eta(dist)
            if now + eta_td > batch.usable_until:
                continue
            if now + eta_td > demand.delivery_deadline:
                continue
            feasible.append({"demand": demand, "unfilled": unfilled, "dist": dist, "best_vehicle": best_vehicle, "buy": buy})

        if not feasible:
            return []

        total_unfilled = sum(f["unfilled"] for f in feasible)
        results: List[MatchProposal] = []

        for f in feasible:
            if remaining_batch_qty <= 0:
                break
            demand = f["demand"]
            share = (f["unfilled"] / total_unfilled) * batch.quantity_available
            qty = round(min(share, f["unfilled"], remaining_batch_qty), 2)
            if qty < batch.min_sale_quantity:
                continue
            remaining_batch_qty -= qty

            dist = f["dist"]
            best_vehicle = f["best_vehicle"]
            t_cost = transport_cost(dist, best_vehicle.cost_per_km)
            gross = round(qty * batch.asking_price, 2)
            fee = round(gross * PLATFORM_FEE_RATE, 2)
            proceeds = round(gross - t_cost - fee, 2)
            score = (
                0.30 * cls._freshness_score(batch, demand)
                + 0.25 * cls._value_score(batch, demand)
                + 0.25 * cls._transport_efficiency(dist)
                + 0.20 * min(1.0, qty / demand.quantity_required)
            )

            proposal = MatchProposal(
                batch_id=batch.id,
                demand_id=demand.id,
                proposed_quantity=qty,
                proposed_price=batch.asking_price,
                estimated_transport_cost=t_cost,
                platform_fee=fee,
                supplier_proceeds=proceeds,
                score=round(score, 4),
                status="pending",
            )

            if persist:
                db.add(proposal)
                db.commit()
                db.refresh(proposal)
                buyer_name = f["buy"].name if f["buy"] else f"Buyer {demand.buyer_id}"
                pct = round(qty / batch.quantity_available * 100)
                _log(
                    db, "match_found", "matching",
                    f"[AUTO-SPLIT] {batch.produce_type} {qty}kg ({pct}%) → {buyer_name} "
                    f"({len(feasible)} buyers share batch #{batch.id})",
                    entity_id=proposal.id, entity_type="proposal", nxt="pending",
                )
            results.append(proposal)

        results.sort(key=lambda p: p.score, reverse=True)
        return results


# ---------------------------------------------------------------------------
# Logistics Agent
# ---------------------------------------------------------------------------
class LogisticsAgent:
    """Assigns vehicles, calculates ETAs, validates capacity & freshness."""

    @staticmethod
    def assign_vehicle(
        db: Session,
        batch: InventoryBatch,
        demand: DemandRequest,
        quantity: float,
    ) -> Optional[Vehicle]:
        now = datetime.now(timezone.utc)
        suppliers = {s.id: s for s in db.exec(select(Supplier)).all()}
        buyers = {b.id: b for b in db.exec(select(Buyer)).all()}

        sup = suppliers.get(batch.supplier_id)
        buy = buyers.get(demand.buyer_id)
        if sup and buy and sup.lat and buy.lat:
            dist = _haversine(sup.lat, sup.lng, buy.lat, buy.lng)
        else:
            dist = 80.0

        eta_td = estimate_eta(dist)
        estimated_arrival = now + eta_td

        # Hard checks before assigning
        if estimated_arrival > batch.usable_until:
            return None
        if estimated_arrival > demand.delivery_deadline:
            return None

        vehicles = db.exec(
            select(Vehicle).where(
                Vehicle.status == "available",
                Vehicle.availability_end >= demand.delivery_deadline,
            )
        ).all()

        best: Optional[Vehicle] = None
        for v in vehicles:
            # remaining capacity check
            if (v.assigned_load_kg + quantity) > v.capacity_kg:
                continue
            if best is None or v.cost_per_km < best.cost_per_km:
                best = v

        if best:
            prev = best.status
            best.assigned_load_kg += quantity
            if best.assigned_load_kg >= best.capacity_kg:
                best.status = "assigned"
            db.add(best)
            db.commit()
            db.refresh(best)
            _log(db, "vehicle_assigned", "logistics",
                 f"Vehicle {best.id} ({best.vehicle_type}) assigned {quantity}kg, ETA {estimated_arrival.strftime('%H:%M')}",
                 entity_id=best.id, entity_type="vehicle", prev=prev,
                 nxt="assigned" if best.status == "assigned" else "available")

        return best

    @staticmethod
    def release_vehicle(db: Session, vehicle_id: int, quantity: float, reason: str = ""):
        vehicle = db.get(Vehicle, vehicle_id)
        if not vehicle:
            return
        prev = vehicle.status
        vehicle.assigned_load_kg = max(0.0, vehicle.assigned_load_kg - quantity)
        vehicle.status = "available"
        db.add(vehicle)
        db.commit()
        _log(db, "vehicle_released", "logistics",
             f"Vehicle {vehicle_id} released {quantity}kg load",
             entity_id=vehicle_id, entity_type="vehicle", prev=prev, nxt="available", reason=reason)


# ---------------------------------------------------------------------------
# Recovery Agent
# ---------------------------------------------------------------------------
class RecoveryAgent:
    """Handles disruptions: vehicle unavailability, buyer cancellations, new demand."""

    @staticmethod
    def handle_vehicle_unavailable(db: Session, vehicle_id: int) -> List[Order]:
        """
        Mark vehicle as unavailable, find replacement for every in-flight order.
        Returns list of orders that were successfully replanned.
        """
        vehicle = db.get(Vehicle, vehicle_id)
        if not vehicle:
            return []

        prev = vehicle.status
        vehicle.status = "unavailable"
        vehicle.assigned_load_kg = 0.0
        db.add(vehicle)
        db.commit()
        _log(db, "vehicle_unavailable", "recovery",
             f"Vehicle {vehicle_id} marked unavailable. Starting replanning…",
             entity_id=vehicle_id, entity_type="vehicle", prev=prev, nxt="unavailable")

        # Find affected orders
        affected_orders = db.exec(
            select(Order).where(
                Order.vehicle_id == vehicle_id,
                Order.status.in_(["confirmed", "pickup_scheduled"]),
            )
        ).all()

        replanned = []
        for order in affected_orders:
            batch = db.get(InventoryBatch, order.batch_id)
            demand = db.get(DemandRequest, order.demand_id) if hasattr(order, "demand_id") else None

            # Try to find a replacement demand
            demands = db.exec(
                select(DemandRequest).where(
                    DemandRequest.produce_type == batch.produce_type,
                    DemandRequest.status.in_(["open", "partially_fulfilled"]),
                )
            ).all()
            best_demand = demands[0] if demands else None

            new_vehicle = None
            if best_demand:
                new_vehicle = LogisticsAgent.assign_vehicle(
                    db, batch, best_demand, order.quantity
                )

            if new_vehicle:
                prev_v = order.vehicle_id
                order.vehicle_id = new_vehicle.id
                db.add(order)
                db.commit()
                _log(db, "order_replanned", "recovery",
                     f"Order {order.id}: vehicle replaced {prev_v}→{new_vehicle.id}",
                     entity_id=order.id, entity_type="order",
                     prev=f"vehicle_{prev_v}", nxt=f"vehicle_{new_vehicle.id}",
                     reason="Original vehicle unavailable")
                replanned.append(order)
            else:
                # No replacement – escalate
                order.status = "needs_review"
                db.add(order)
                db.commit()
                _log(db, "escalation_required", "recovery",
                     f"Order {order.id}: no replacement vehicle found. Human review needed.",
                     entity_id=order.id, entity_type="order",
                     prev="confirmed", nxt="needs_review",
                     reason="No feasible replacement vehicle")

        return replanned

    @staticmethod
    def handle_buyer_cancellation(db: Session, order_id: int) -> Dict[str, Any]:
        """
        Cancel an order, release reserved inventory, release vehicle load,
        and search for a replacement buyer.
        """
        order = db.get(Order, order_id)
        if not order:
            return {"success": False, "reason": "Order not found"}
        if order.status in ("delivered", "cancelled"):
            return {"success": False, "reason": f"Order already {order.status}"}

        # Release inventory
        batch = db.get(InventoryBatch, order.batch_id)
        if batch and order.status not in ("delivered",):
            batch.quantity_reserved = max(0.0, batch.quantity_reserved - order.quantity)
            batch.quantity_available += order.quantity
            db.add(batch)

        # Release vehicle
        if order.vehicle_id:
            LogisticsAgent.release_vehicle(
                db, order.vehicle_id, order.quantity,
                reason=f"Buyer cancellation of order {order_id}"
            )

        prev = order.status
        order.status = "cancelled"
        order.rejection_reason = "Cancelled by buyer"
        db.add(order)
        db.commit()

        _log(db, "order_cancelled", "recovery",
             f"Order {order_id} cancelled. {order.quantity}kg returned to inventory.",
             entity_id=order_id, entity_type="order", prev=prev, nxt="cancelled",
             reason="Buyer cancellation")

        # Search for a new buyer
        new_proposals = MatchingAgent.run(db, persist=True)

        return {
            "success": True,
            "released_qty": order.quantity,
            "new_proposals": len(new_proposals),
        }

    @staticmethod
    def handle_new_demand(db: Session, demand_id: int) -> List[MatchProposal]:
        """Re-run matching engine when new demand arrives."""
        demand = db.get(DemandRequest, demand_id)
        if not demand:
            return []

        _log(db, "new_demand_received", "recovery",
             f"New demand {demand_id}: {demand.quantity_required}kg {demand.produce_type}. Triggering matching.",
             entity_id=demand_id, entity_type="demand", nxt="matching")

        return MatchingAgent.run(db, persist=True)


# ---------------------------------------------------------------------------
# Coordinator Agent (entry-point orchestrator)
# ---------------------------------------------------------------------------
class CoordinatorAgent:
    """
    Top-level orchestrator that:
    1. Marks expired batches
    2. Runs inventory risk scan
    3. Runs the matching engine
    Returns a complete situational-awareness snapshot.
    """

    @staticmethod
    def run_cycle(db: Session) -> Dict[str, Any]:
        # Step 1 – expire stale batches
        expired_count = InventoryAgent.mark_expired(db)

        # Step 2 – identify at-risk inventory
        at_risk = InventoryAgent.get_at_risk(db)

        # Step 3 – generate proposals (don't persist duplicates – only run if no pending proposals)
        existing_pending = db.exec(
            select(MatchProposal).where(MatchProposal.status == "pending")
        ).all()
        if not existing_pending:
            proposals = MatchingAgent.run(db, persist=True)
        else:
            proposals = existing_pending

        if expired_count or at_risk or proposals:
            _log(db, "cycle_complete", "coordinator",
                 f"Cycle: {expired_count} expired, {len(at_risk)} at-risk, {len(proposals)} proposals",
                 nxt="ready")

        return {
            "expired_batches": expired_count,
            "at_risk": [
                {
                    "batch_id": r["batch"].id,
                    "produce_type": r["batch"].produce_type,
                    "quantity_available": r["batch"].quantity_available,
                    "risk_level": r["risk_level"],
                    "hours_remaining": round(r["hours_remaining"], 1),
                    "value_at_risk": r["value_at_risk"],
                }
                for r in at_risk
            ],
            "match_proposals": len(proposals),
        }

    @staticmethod
    def confirm_order_from_proposal(db: Session, proposal_id: int) -> Order:
        """
        Accept a match proposal → create an Order, reserve inventory, assign vehicle.
        This is the one function that finalises a transaction.
        """
        proposal = db.get(MatchProposal, proposal_id)
        if not proposal or proposal.status != "pending":
            raise ValueError("Proposal not found or already actioned")

        batch = db.get(InventoryBatch, proposal.batch_id)
        demand = db.get(DemandRequest, proposal.demand_id)

        if not batch or not demand:
            raise ValueError("Linked batch or demand not found")

        # Re-validate everything at confirmation time (state may have changed)
        if batch.status != "available":
            raise ValueError(f"Batch {batch.id} is no longer available (status: {batch.status})")
        if batch.asking_price > demand.maximum_price:
            raise ValueError("Price no longer acceptable to buyer")

        qty = min(proposal.proposed_quantity, batch.quantity_available,
                  demand.quantity_required - demand.quantity_fulfilled)
        if qty < batch.min_sale_quantity:
            raise ValueError("Remaining quantity below minimum sale threshold")

        # Assign vehicle
        vehicle = LogisticsAgent.assign_vehicle(db, batch, demand, qty)
        if not vehicle:
            raise ValueError("No feasible vehicle available for delivery")

        # Reserve inventory
        batch.quantity_reserved = batch.quantity_reserved + qty
        batch.quantity_available = batch.quantity_available - qty
        if batch.quantity_available <= 0:
            batch.status = "reserved"
        db.add(batch)

        # Update demand fulfillment
        demand.quantity_fulfilled += qty
        if demand.quantity_fulfilled >= demand.quantity_required:
            demand.status = "fulfilled"
        else:
            demand.status = "partially_fulfilled"
        db.add(demand)

        # Calculate ETA
        suppliers = {s.id: s for s in db.exec(select(Supplier)).all()}
        buyers = {b.id: b for b in db.exec(select(Buyer)).all()}
        sup = suppliers.get(batch.supplier_id)
        buy = buyers.get(demand.buyer_id)
        if sup and buy and sup.lat and buy.lat:
            dist = _haversine(sup.lat, sup.lng, buy.lat, buy.lng)
        else:
            dist = 80.0
        eta = datetime.now(timezone.utc) + estimate_eta(dist)

        # Create order
        gross = round(qty * proposal.proposed_price, 2)
        fee = round(gross * PLATFORM_FEE_RATE, 2)
        t_cost = proposal.estimated_transport_cost
        proceeds = round(gross - fee - t_cost, 2)

        order = Order(
            proposal_id=proposal.id,
            buyer_id=demand.buyer_id,
            supplier_id=batch.supplier_id,
            batch_id=batch.id,
            vehicle_id=vehicle.id,
            quantity=qty,
            agreed_price=proposal.proposed_price,
            gross_value=gross,
            transport_cost=t_cost,
            platform_fee=fee,
            supplier_proceeds=proceeds,
            status="confirmed",
            confirmed_at=datetime.now(timezone.utc),
            estimated_arrival=eta,
        )
        db.add(order)

        # Close proposal
        proposal.status = "accepted"
        db.add(proposal)

        db.commit()
        db.refresh(order)

        _log(db, "order_created", "coordinator",
             f"Order {order.id}: {qty}kg {batch.produce_type} → buyer {demand.buyer_id} confirmed. ETA {eta.strftime('%d %b %H:%M')}",
             entity_id=order.id, entity_type="order", prev="proposed", nxt="confirmed")

        return order
