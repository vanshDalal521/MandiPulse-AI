"""
MandiPulse AI – FastAPI Application
Full REST API for the platform covering all features.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any

import os
import requests
from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from .database import create_db_and_tables, get_session
from . import models
from .agents import CoordinatorAgent, RecoveryAgent, InventoryAgent, MatchingAgent

app = FastAPI(
    title="MandiPulse AI API",
    version="1.0.0",
    description="Agentic AI food supply balancing platform",
)

# Allow all origins for local dev – tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Auto-seed if DB is empty
    from .seed import seed
    seed()


# ============================================================
# Pydantic request / response schemas (separate from ORM models)
# ============================================================

class SupplierCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class BuyerCreate(BaseModel):
    name: str
    buyer_type: Optional[str] = "retailer"
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact: Optional[str] = None

class InventoryCreate(BaseModel):
    supplier_id: int
    produce_type: str
    quantity_available: float
    quality_grade: str
    asking_price: float
    usable_until: datetime
    min_sale_quantity: float = 10.0
    unit: str = "kg"

class DemandCreate(BaseModel):
    buyer_id: int
    produce_type: str
    quantity_required: float
    maximum_price: float
    quality_requirement: str
    delivery_deadline: datetime
    delivery_location: Optional[str] = None

class VehicleCreate(BaseModel):
    vehicle_type: str
    capacity_kg: float
    current_location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    cost_per_km: float
    availability_start: datetime
    availability_end: datetime

class OrderConfirmRequest(BaseModel):
    proposal_id: int

class AdvanceOrderRequest(BaseModel):
    status: str  # pickup_scheduled | picked_up | in_transit | delivered

class InstantBuyRequest(BaseModel):
    buyer_id: int
    quantity: float
    delivery_location: Optional[str] = None

# ============================================================
# Helpers
# ============================================================
def _get_or_404(db: Session, model, entity_id: int, label: str):
    obj = db.get(model, entity_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} {entity_id} not found")
    return obj


# ============================================================
# Health
# ============================================================
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ============================================================
# Supplier endpoints
# ============================================================
@app.get("/suppliers/", response_model=List[models.Supplier])
def list_suppliers(db: Session = Depends(get_session)):
    return db.exec(select(models.Supplier).where(models.Supplier.account_status == "active")).all()

@app.post("/suppliers/", response_model=models.Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(body: SupplierCreate, db: Session = Depends(get_session)):
    obj = models.Supplier(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.get("/suppliers/{supplier_id}", response_model=models.Supplier)
def get_supplier(supplier_id: int, db: Session = Depends(get_session)):
    return _get_or_404(db, models.Supplier, supplier_id, "Supplier")


# ============================================================
# Buyer endpoints
# ============================================================
@app.get("/buyers/", response_model=List[models.Buyer])
def list_buyers(db: Session = Depends(get_session)):
    return db.exec(select(models.Buyer).where(models.Buyer.account_status == "active")).all()

@app.post("/buyers/", response_model=models.Buyer, status_code=status.HTTP_201_CREATED)
def create_buyer(body: BuyerCreate, db: Session = Depends(get_session)):
    obj = models.Buyer(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.get("/buyers/{buyer_id}", response_model=models.Buyer)
def get_buyer(buyer_id: int, db: Session = Depends(get_session)):
    return _get_or_404(db, models.Buyer, buyer_id, "Buyer")


# ============================================================
# Inventory endpoints
# ============================================================
@app.get("/inventory/", response_model=List[models.InventoryBatch])
def list_inventory(db: Session = Depends(get_session)):
    return db.exec(
        select(models.InventoryBatch).where(
            models.InventoryBatch.status.in_(["available", "reserved"])
        )
    ).all()

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/mandipulse-inventory")
N8N_DISRUPTION_WEBHOOK_URL = os.getenv("N8N_DISRUPTION_WEBHOOK_URL", "http://localhost:5678/webhook/mandipulse-disruption")

def trigger_n8n_inventory_webhook(batch_data: dict):
    try:
        requests.post(N8N_WEBHOOK_URL, json=batch_data, timeout=3)
    except Exception as e:
        # Non-blocking, fallback if n8n is not running
        pass

def trigger_n8n_disruption_webhook(disruption_data: dict):
    try:
        requests.post(N8N_DISRUPTION_WEBHOOK_URL, json=disruption_data, timeout=3)
    except Exception as e:
        # Non-blocking, fallback if n8n is not running
        pass

@app.post("/inventory/", response_model=models.InventoryBatch, status_code=status.HTTP_201_CREATED)
def create_inventory(body: InventoryCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    _get_or_404(db, models.Supplier, body.supplier_id, "Supplier")
    obj = models.InventoryBatch(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)

    # 1. Notify n8n agent workflow (non-blocking, fire-and-forget)
    background_tasks.add_task(
        trigger_n8n_inventory_webhook,
        {
            "event": "inventory.created",
            "inventory_batch_id": obj.id,
            "produce_type": obj.produce_type,
            "available_quantity_kg": obj.quantity_available,
            "quality_grade": obj.quality_grade,
            "asking_price": obj.asking_price,
            "freshness_deadline": obj.usable_until.isoformat(),
            "supplier_id": obj.supplier_id
        }
    )

    # 2. Immediately auto-match: split this batch across all open buyer demands
    #    This runs in the background so the POST responds quickly, but proposals
    #    will appear in the DB within milliseconds.
    def _auto_match(batch_id: int):
        from .database import get_session as _gs
        from .agents import MatchingAgent as _MA
        with next(_gs()) as _db:
            proposals = _MA.run_for_batch(_db, batch_id, persist=True)
            if proposals:
                # Log a coordinator event summarising the split
                n = len(proposals)
                total_qty = sum(p.proposed_quantity for p in proposals)
                _log_summary = (
                    f"Auto-split: {n} proposal(s) created for batch #{batch_id} "
                    f"({total_qty} kg distributed across {n} buyer(s))"
                )
                # persist coordinator event inline since we have the session
                from .models import AgentEvent
                ev = AgentEvent(
                    event_type="auto_split_complete",
                    agent="coordinator",
                    summary=_log_summary,
                    entity_id=batch_id,
                    entity_type="batch",
                    new_state="matched",
                )
                _db.add(ev)
                _db.commit()

    background_tasks.add_task(_auto_match, obj.id)
    return obj


@app.get("/inventory/{batch_id}", response_model=models.InventoryBatch)
def get_inventory(batch_id: int, db: Session = Depends(get_session)):
    return _get_or_404(db, models.InventoryBatch, batch_id, "Batch")

@app.patch("/inventory/{batch_id}/status")
def update_inventory_status(batch_id: int, new_status: str, db: Session = Depends(get_session)):
    batch = _get_or_404(db, models.InventoryBatch, batch_id, "Batch")
    allowed = ["available", "reserved", "sold", "expired", "removed"]
    if new_status not in allowed:
        raise HTTPException(400, f"Status must be one of {allowed}")
    prev = batch.status
    batch.status = new_status
    db.add(batch)
    db.commit()
    return {"batch_id": batch_id, "previous": prev, "current": new_status}

@app.post("/inventory/{batch_id}/instant-buy", status_code=status.HTTP_201_CREATED)
def instant_buy(batch_id: int, body: InstantBuyRequest, db: Session = Depends(get_session)):
    """Real-time instant purchase of surplus produce by a buyer."""
    batch = _get_or_404(db, models.InventoryBatch, batch_id, "InventoryBatch")
    buyer = _get_or_404(db, models.Buyer, body.buyer_id, "Buyer")
    supplier = _get_or_404(db, models.Supplier, batch.supplier_id, "Supplier")

    if batch.status != "available" or batch.quantity_available <= 0:
        raise HTTPException(400, "This surplus lot is no longer available.")

    if body.quantity <= 0:
        raise HTTPException(400, "Quantity must be greater than 0 kg.")

    if body.quantity > batch.quantity_available:
        raise HTTPException(400, f"Requested quantity ({body.quantity} kg) exceeds available stock ({batch.quantity_available} kg).")

    from .agents import _haversine, estimate_eta, transport_cost, PLATFORM_FEE_RATE, _log

    # Logistics distance & vehicle
    dist = 80.0
    if supplier.lat and buyer.lat and supplier.lng and buyer.lng:
        dist = _haversine(supplier.lat, supplier.lng, buyer.lat, buyer.lng)

    vehicles = db.exec(select(models.Vehicle).where(models.Vehicle.status == "available")).all()
    best_vehicle = None
    for v in vehicles:
        if (v.assigned_load_kg + body.quantity) <= v.capacity_kg:
            if best_vehicle is None or v.cost_per_km < best_vehicle.cost_per_km:
                best_vehicle = v

    if not best_vehicle and vehicles:
        best_vehicle = vehicles[0]

    if not best_vehicle:
        best_vehicle = models.Vehicle(
            vehicle_type="Express Van",
            capacity_kg=max(1500.0, body.quantity * 1.5),
            current_location=supplier.location,
            cost_per_km=12.0,
            availability_start=datetime.now(timezone.utc),
            availability_end=datetime.now(timezone.utc) + timedelta(days=2),
            status="available"
        )
        db.add(best_vehicle)
        db.commit()
        db.refresh(best_vehicle)

    # Cost breakdown
    gross = round(body.quantity * batch.asking_price, 2)
    t_cost = transport_cost(dist, best_vehicle.cost_per_km)
    fee = round(gross * PLATFORM_FEE_RATE, 2)
    proceeds = round(gross - fee - t_cost, 2)
    eta = datetime.now(timezone.utc) + estimate_eta(dist)

    # Update vehicle assigned load
    best_vehicle.assigned_load_kg += body.quantity
    if best_vehicle.assigned_load_kg >= best_vehicle.capacity_kg:
        best_vehicle.status = "assigned"
    db.add(best_vehicle)

    # Reserve / deduct inventory batch
    batch.quantity_reserved += body.quantity
    batch.quantity_available = round(batch.quantity_available - body.quantity, 2)
    if batch.quantity_available <= 0:
        batch.status = "reserved"
    db.add(batch)

    # Record fulfilled demand for this buyer
    demand = models.DemandRequest(
        buyer_id=buyer.id,
        produce_type=batch.produce_type,
        quantity_required=body.quantity,
        quantity_fulfilled=body.quantity,
        maximum_price=batch.asking_price,
        quality_requirement=batch.quality_grade,
        delivery_deadline=eta + timedelta(hours=12),
        delivery_location=body.delivery_location or buyer.location,
        status="fulfilled",
    )
    db.add(demand)
    db.commit()
    db.refresh(demand)

    # Create confirmed order
    order = models.Order(
        buyer_id=buyer.id,
        supplier_id=supplier.id,
        batch_id=batch.id,
        demand_id=demand.id,
        vehicle_id=best_vehicle.id,
        quantity=body.quantity,
        agreed_price=batch.asking_price,
        gross_value=gross,
        transport_cost=t_cost,
        platform_fee=fee,
        supplier_proceeds=proceeds,
        status="confirmed",
        confirmed_at=datetime.now(timezone.utc),
        estimated_arrival=eta,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Log audit event
    _log(
        db,
        event_type="instant_buy_confirmed",
        agent="coordinator",
        summary=f"⚡ REAL-TIME BUY: Buyer {buyer.name} purchased {body.quantity}kg {batch.produce_type} @ ₹{batch.asking_price}/kg from {supplier.name} (Vehicle #{best_vehicle.id} assigned, ETA {eta.strftime('%H:%M')})",
        entity_id=order.id,
        entity_type="order",
        prev="available",
        nxt="confirmed",
        reason="Direct Real-Time Purchase via MandiPulse Live Market Feed"
    )

    return {
        "id": order.id,
        "buyer_id": order.buyer_id,
        "supplier_id": order.supplier_id,
        "batch_id": order.batch_id,
        "demand_id": order.demand_id,
        "vehicle_id": order.vehicle_id,
        "quantity": order.quantity,
        "agreed_price": order.agreed_price,
        "gross_value": order.gross_value,
        "transport_cost": order.transport_cost,
        "platform_fee": order.platform_fee,
        "supplier_proceeds": order.supplier_proceeds,
        "status": order.status,
        "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
        "estimated_arrival": order.estimated_arrival.isoformat() if order.estimated_arrival else None,
    }

@app.get("/inventory/at-risk/list")
def at_risk_inventory(db: Session = Depends(get_session)):
    return InventoryAgent.get_at_risk(db)


# ============================================================
# Demand endpoints
# ============================================================
@app.get("/demands/", response_model=List[models.DemandRequest])
def list_demands(db: Session = Depends(get_session)):
    return db.exec(
        select(models.DemandRequest).where(
            models.DemandRequest.status.in_(["open", "partially_fulfilled"])
        )
    ).all()

@app.post("/demands/", response_model=models.DemandRequest, status_code=status.HTTP_201_CREATED)
def create_demand(body: DemandCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    _get_or_404(db, models.Buyer, body.buyer_id, "Buyer")
    obj = models.DemandRequest(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)

    # Re-run full matching in background: existing batches now compete for the new demand
    def _rematch():
        from .database import get_session as _gs
        from .agents import MatchingAgent as _MA
        with next(_gs()) as _db:
            _MA.run(_db, persist=True)

    background_tasks.add_task(_rematch)
    return obj


@app.get("/demands/{demand_id}", response_model=models.DemandRequest)
def get_demand(demand_id: int, db: Session = Depends(get_session)):
    return _get_or_404(db, models.DemandRequest, demand_id, "Demand")

@app.delete("/demands/{demand_id}/cancel")
def cancel_demand(demand_id: int, db: Session = Depends(get_session)):
    demand = _get_or_404(db, models.DemandRequest, demand_id, "Demand")
    if demand.status == "cancelled":
        raise HTTPException(400, "Already cancelled")
    demand.status = "cancelled"
    db.add(demand)
    db.commit()
    return {"detail": "Demand cancelled"}


# ============================================================
# Vehicle endpoints
# ============================================================
@app.get("/vehicles/", response_model=List[models.Vehicle])
def list_vehicles(db: Session = Depends(get_session)):
    return db.exec(select(models.Vehicle)).all()

@app.post("/vehicles/", response_model=models.Vehicle, status_code=status.HTTP_201_CREATED)
def create_vehicle(body: VehicleCreate, db: Session = Depends(get_session)):
    obj = models.Vehicle(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.post("/vehicles/{vehicle_id}/unavailable")
def mark_vehicle_unavailable(vehicle_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    """Simulate vehicle breakdown / cancellation and trigger replanning."""
    result = RecoveryAgent.handle_vehicle_unavailable(db, vehicle_id)
    background_tasks.add_task(
        trigger_n8n_disruption_webhook,
        {
            "event": "vehicle.unavailable",
            "vehicle_id": vehicle_id,
            "replanned_orders_count": len(result),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    return {"replanned_orders": len(result), "detail": f"{len(result)} orders replanned"}


# ============================================================
# Match Proposal endpoints
# ============================================================
@app.get("/proposals/", response_model=List[models.MatchProposal])
def list_proposals(db: Session = Depends(get_session)):
    return db.exec(
        select(models.MatchProposal)
        .where(models.MatchProposal.status == "pending")
        .order_by(models.MatchProposal.score.desc())
    ).all()

@app.post("/proposals/refresh")
def refresh_proposals(db: Session = Depends(get_session)):
    """Re-run matching engine; returns count of new proposals created."""
    proposals = MatchingAgent.run(db, persist=True)
    return {"proposals_generated": len(proposals)}


# ============================================================
# Order endpoints
# ============================================================
@app.get("/orders/", response_model=List[models.Order])
def list_orders(db: Session = Depends(get_session)):
    return db.exec(select(models.Order)).all()

@app.post("/orders/confirm", response_model=models.Order, status_code=status.HTTP_201_CREATED)
def confirm_order(body: OrderConfirmRequest, db: Session = Depends(get_session)):
    """Accept a match proposal and create a confirmed order."""
    try:
        order = CoordinatorAgent.confirm_order_from_proposal(db, body.proposal_id)
        return order
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/orders/{order_id}", response_model=models.Order)
def get_order(order_id: int, db: Session = Depends(get_session)):
    return _get_or_404(db, models.Order, order_id, "Order")

@app.patch("/orders/{order_id}/advance")
def advance_order_status(order_id: int, body: AdvanceOrderRequest, db: Session = Depends(get_session)):
    """Move an order through the delivery state machine."""
    order = _get_or_404(db, models.Order, order_id, "Order")
    valid_transitions = {
        "confirmed": "pickup_scheduled",
        "pickup_scheduled": "picked_up",
        "picked_up": "in_transit",
        "in_transit": "delivered",
    }
    expected_next = valid_transitions.get(order.status)
    if body.status != expected_next:
        raise HTTPException(400, f"Expected next status: {expected_next}, got {body.status}")
    prev = order.status
    order.status = body.status
    if body.status == "delivered":
        order.delivered_at = datetime.now(timezone.utc)
        # Mark batch as sold if qty becomes 0
        batch = db.get(models.InventoryBatch, order.batch_id)
        if batch:
            batch.quantity_reserved = max(0, batch.quantity_reserved - order.quantity)
            if batch.quantity_available <= 0 and batch.quantity_reserved <= 0:
                batch.status = "sold"
            db.add(batch)
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"order_id": order_id, "previous": prev, "current": order.status}

@app.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    """Buyer cancels order – releases inventory and triggers replanning."""
    result = RecoveryAgent.handle_buyer_cancellation(db, order_id)
    if not result["success"]:
        raise HTTPException(400, result["reason"])
    background_tasks.add_task(
        trigger_n8n_disruption_webhook,
        {
            "event": "order.cancelled",
            "order_id": order_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    return result


# ============================================================
# Agent / Operations endpoints
# ============================================================
@app.post("/agent/cycle")
def run_agent_cycle(db: Session = Depends(get_session)):
    """Trigger a full coordinator cycle (expire → scan → match)."""
    result = CoordinatorAgent.run_cycle(db)
    return result

@app.get("/agent/events", response_model=List[models.AgentEvent])
def list_agent_events(limit: int = 50, db: Session = Depends(get_session)):
    events = db.exec(
        select(models.AgentEvent)
        .order_by(models.AgentEvent.created_at.desc())
        .limit(limit)
    ).all()
    return events


# ============================================================
# Analytics / Dashboard
# ============================================================
@app.get("/analytics/overview")
def analytics_overview(db: Session = Depends(get_session)):
    orders = db.exec(select(models.Order)).all()
    delivered = [o for o in orders if o.status == "delivered"]
    active = [o for o in orders if o.status in ("confirmed", "pickup_scheduled", "picked_up", "in_transit")]
    cancelled = [o for o in orders if o.status == "cancelled"]
    needs_review = [o for o in orders if o.status == "needs_review"]

    gross_txn_value = sum(o.gross_value for o in delivered)
    platform_revenue = sum(o.platform_fee for o in delivered)
    supplier_proceeds = sum(o.supplier_proceeds for o in delivered)
    kg_moved = sum(o.quantity for o in delivered)
    total_kg_listed = sum(
        b.quantity_available + b.quantity_reserved
        for b in db.exec(select(models.InventoryBatch)).all()
    )

    return {
        "orders": {
            "total": len(orders),
            "delivered": len(delivered),
            "active": len(active),
            "cancelled": len(cancelled),
            "needs_review": len(needs_review),
        },
        "financials": {
            "gross_transaction_value_inr": round(gross_txn_value, 2),
            "platform_revenue_inr": round(platform_revenue, 2),
            "supplier_proceeds_inr": round(supplier_proceeds, 2),
        },
        "food_impact": {
            "kg_moved": round(kg_moved, 2),
            "total_kg_listed": round(total_kg_listed, 2),
            "surplus_sold_pct": round(100 * kg_moved / max(total_kg_listed, 1), 1),
        },
        "inventory": {
            "at_risk": len(InventoryAgent.get_at_risk(db)),
            "available_batches": len(
                db.exec(select(models.InventoryBatch).where(models.InventoryBatch.status == "available")).all()
            ),
        },
    }


# ============================================================
# MandiPulse AI Agent / n8n Tool Endpoints
# ============================================================

class MatchPreviewRequest(BaseModel):
    inventory_batch_id: Optional[Any] = None
    produce_type: Optional[str] = None
    available_quantity_kg: Optional[float] = None
    freshness_deadline: Optional[Any] = None
    quality_grade: Optional[str] = None
    asking_price: Optional[float] = None

class MatchProposalCreate(BaseModel):
    batch_id: int
    demand_id: int
    proposed_quantity: float
    proposed_price: float
    estimated_transport_cost: Optional[float] = 0.0
    platform_fee: Optional[float] = 0.0
    supplier_proceeds: Optional[float] = 0.0
    score: Optional[float] = 0.9
    status: Optional[str] = "pending"

class AgentEventRecord(BaseModel):
    event_type: str
    agent: str = "matching_agent"
    summary: str
    reason: Optional[str] = None
    entity_id: Optional[int] = None
    entity_type: Optional[str] = "batch"
    previous_state: Optional[str] = None
    new_state: Optional[str] = None


@app.get("/api/inventory/available")
def api_get_available_inventory(db: Session = Depends(get_session)):
    """Agent Tool: Reads available surplus stock."""
    return db.exec(
        select(models.InventoryBatch).where(
            models.InventoryBatch.status == "available",
            models.InventoryBatch.quantity_available > 0
        )
    ).all()


@app.get("/api/demands/open")
def api_get_open_demands(db: Session = Depends(get_session)):
    """Agent Tool: Reads buyer open requirements."""
    return db.exec(
        select(models.DemandRequest).where(
            models.DemandRequest.status.in_(["open", "partially_fulfilled"])
        )
    ).all()


@app.get("/api/vehicles/available")
def api_get_available_vehicles(db: Session = Depends(get_session)):
    """Agent Tool: Checks available vehicles for logistics."""
    return db.exec(
        select(models.Vehicle).where(models.Vehicle.status == "available")
    ).all()


@app.post("/api/matches/preview")
def api_preview_matches(req: MatchPreviewRequest, db: Session = Depends(get_session)):
    """Agent Tool: Calculates feasible supplier-buyer matches."""
    # Find matching batch or use provided batch_id
    batch = None
    if req.inventory_batch_id:
        try:
            bid = int(req.inventory_batch_id) if str(req.inventory_batch_id).isdigit() else None
            if bid:
                batch = db.get(models.InventoryBatch, bid)
        except Exception:
            pass

    if not batch and req.produce_type:
        batches = db.exec(
            select(models.InventoryBatch).where(
                models.InventoryBatch.produce_type == req.produce_type,
                models.InventoryBatch.status == "available"
            )
        ).all()
        if batches:
            batch = batches[0]

    if not batch:
        # Fallback to general matching run
        all_proposals = MatchingAgent.run(db, persist=False)
        return [
            {
                "proposal_id": p.id,
                "batch_id": p.batch_id,
                "demand_id": p.demand_id,
                "proposed_quantity": p.proposed_quantity,
                "proposed_price": p.proposed_price,
                "score": p.score,
                "estimated_transport_cost": p.estimated_transport_cost,
                "supplier_proceeds": p.supplier_proceeds
            }
            for p in all_proposals
        ]

    # Matching logic for specific batch — with proportional multi-buyer splitting
    demands = db.exec(
        select(models.DemandRequest).where(
            models.DemandRequest.produce_type == batch.produce_type,
            models.DemandRequest.status.in_(["open", "partially_fulfilled"])
        )
    ).all()

    suppliers = {s.id: s for s in db.exec(select(models.Supplier)).all()}
    buyers = {b.id: b for b in db.exec(select(models.Buyer)).all()}
    vehicles = db.exec(select(models.Vehicle).where(models.Vehicle.status == "available")).all()
    sup = suppliers.get(batch.supplier_id)
    from .agents import _haversine

    # First pass: collect feasible demands
    feasible_candidates = []
    for demand in demands:
        unfilled = demand.quantity_required - demand.quantity_fulfilled
        if unfilled <= 0:
            continue
        if not MatchingAgent._compatibility(batch, demand):
            continue
        buy = buyers.get(demand.buyer_id)
        dist = 80.0
        if sup and buy and sup.lat and buy.lat:
            dist = _haversine(sup.lat, sup.lng, buy.lat, buy.lng)
        best_v = None
        for v in vehicles:
            if v.capacity_kg >= min(batch.quantity_available, unfilled):
                if best_v is None or v.cost_per_km < best_v.cost_per_km:
                    best_v = v
        feasible_candidates.append({
            "demand": demand, "unfilled": unfilled, "dist": dist,
            "best_v": best_v, "buy": buy
        })

    # Second pass: proportional allocation
    total_unfilled = sum(f["unfilled"] for f in feasible_candidates) or 1
    remaining_qty = batch.quantity_available
    feasible_matches = []
    for f in feasible_candidates:
        if remaining_qty <= 0:
            break
        demand = f["demand"]
        share = (f["unfilled"] / total_unfilled) * batch.quantity_available
        allocated_qty = round(min(share, f["unfilled"], remaining_qty), 2)
        if allocated_qty < batch.min_sale_quantity:
            continue
        remaining_qty -= allocated_qty

        buy = f["buy"]
        best_v = f["best_v"]
        dist = f["dist"]
        t_cost = round(dist * (best_v.cost_per_km if best_v else 12.0), 2)
        gross = round(allocated_qty * batch.asking_price, 2)
        fee = round(gross * 0.02, 2)
        proceeds = round(gross - t_cost - fee, 2)
        pct = round(allocated_qty / batch.quantity_available * 100)

        feasible_matches.append({
            "batch_id": batch.id,
            "demand_id": demand.id,
            "buyer_id": demand.buyer_id,
            "buyer_name": buy.name if buy else f"Buyer {demand.buyer_id}",
            "produce_type": batch.produce_type,
            "quantity_available_batch": batch.quantity_available,
            "quantity_demanded": f["unfilled"],
            "allocated_quantity": allocated_qty,
            "allocation_pct": pct,
            "split_buyers_count": len(feasible_candidates),
            "agreed_price": batch.asking_price,
            "estimated_distance_km": round(dist, 1),
            "assigned_vehicle_id": best_v.id if best_v else None,
            "vehicle_type": best_v.vehicle_type if best_v else "Standard Van",
            "transport_cost": t_cost,
            "platform_fee": fee,
            "supplier_proceeds": proceeds,
            "feasibility": "high" if best_v else "medium_no_dedicated_vehicle",
            "reason": (
                f"Quality grade {batch.quality_grade} ✓ | "
                f"Price ₹{batch.asking_price}/kg ≤ max ₹{demand.maximum_price}/kg ✓ | "
                f"Batch split {pct}% ({allocated_qty}kg) to this buyer "
                f"({len(feasible_candidates)} buyer(s) sharing this batch)"
            )
        })

    return feasible_matches


@app.post("/api/matches/proposals")
def api_create_match_proposal(req: MatchProposalCreate, db: Session = Depends(get_session)):
    """Agent Tool: Saves a proposed match generated by the agent."""
    proposal = models.MatchProposal(**req.dict())
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@app.post("/api/agents/events")
def api_record_agent_event(req: AgentEventRecord, db: Session = Depends(get_session)):
    """Agent Tool: Saves the agent's explanation, actions, and decisions."""
    event = models.AgentEvent(**req.dict())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.post("/buyers/{buyer_id}/auto-procure")
def auto_procure_buyer(buyer_id: int, db: Session = Depends(get_session)):
    """Auto-procures all eligible pending proposals for a buyer in real-time."""
    _get_or_404(db, models.Buyer, buyer_id, "Buyer")
    demands = db.exec(
        select(models.DemandRequest).where(
            models.DemandRequest.buyer_id == buyer_id,
            models.DemandRequest.status.in_(["open", "partially_fulfilled"])
        )
    ).all()
    demand_ids = set(d.id for d in demands)

    pending_proposals = db.exec(
        select(models.MatchProposal).where(
            models.MatchProposal.status == "pending"
        )
    ).all()

    my_proposals = [p for p in pending_proposals if p.demand_id in demand_ids]
    confirmed_orders = []
    for prop in my_proposals:
        try:
            ord_obj = CoordinatorAgent.confirm_order_from_proposal(db, prop.id)
            confirmed_orders.append(ord_obj)
        except Exception:
            continue

    return {
        "buyer_id": buyer_id,
        "auto_procured_count": len(confirmed_orders),
        "orders": [o.id for o in confirmed_orders]
    }


@app.get("/api/n8n/status")
def get_n8n_status():
    """Checks if n8n webhook listener is reachable and provides workflow diagnostics."""
    reachable = False
    try:
        res = requests.get("http://localhost:5678/healthz", timeout=1)
        reachable = res.status_code in (200, 404, 401)
    except Exception:
        reachable = False

    return {
        "n8n_server_url": "http://localhost:5678",
        "reachable": reachable,
        "workflows": [
            {
                "name": "MandiPulse — Surplus Matching Agent",
                "webhook_path": "/webhook/mandipulse-inventory",
                "file": "n8n_mandipulse_surplus_matching_agent.json",
                "role": "Triggered when farmer posts surplus. Agent inspects available stock, open buyer requirements, checks vehicles, proposes splits, and records decisions."
            },
            {
                "name": "MandiPulse — Disruption Recovery Agent",
                "webhook_path": "/webhook/mandipulse-disruption",
                "file": "n8n_mandipulse_disruption_recovery_agent.json",
                "role": "Triggered upon breakdown or cancellation. Inspects active orders, marks vehicles unavailable, substitutes vehicles/demands, and updates proposals."
            }
        ],
        "built_in_fallback": "FastAPI native Python agent engine (CoordinatorAgent, MatchingAgent, RecoveryAgent) is active 24/7."
    }

