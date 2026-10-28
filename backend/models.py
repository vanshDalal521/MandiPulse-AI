"""
MandiPulse AI – SQLModel ORM Models
All tables, enums, and relationships live here.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Supplier
# ---------------------------------------------------------------------------
class Supplier(SQLModel, table=True):
    __tablename__ = "suppliers"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    contact: Optional[str] = None
    location: str
    lat: Optional[float] = None          # geo – optional for map view
    lng: Optional[float] = None
    account_status: str = Field(default="active")  # active | suspended
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Buyer
# ---------------------------------------------------------------------------
class Buyer(SQLModel, table=True):
    __tablename__ = "buyers"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    buyer_type: str = Field(default="retailer")  # retailer | kitchen | wholesaler
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact: Optional[str] = None
    account_status: str = Field(default="active")
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Inventory Batch
# ---------------------------------------------------------------------------
class InventoryBatch(SQLModel, table=True):
    __tablename__ = "inventory_batches"

    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_id: int = Field(foreign_key="suppliers.id", index=True)
    produce_type: str = Field(index=True)
    quantity_available: float          # kg
    quantity_reserved: float = Field(default=0.0)   # kg reserved for open orders
    unit: str = Field(default="kg")
    quality_grade: str                 # A | B | C
    asking_price: float                # INR per kg
    listed_at: datetime = Field(default_factory=_now)
    usable_until: datetime             # freshness deadline (simulation label)
    min_sale_quantity: float = Field(default=10.0)
    status: str = Field(default="available")  # available | reserved | sold | expired | removed
    safety_review: str = Field(default="approved")  # pending | approved | rejected


# ---------------------------------------------------------------------------
# Demand Request
# ---------------------------------------------------------------------------
class DemandRequest(SQLModel, table=True):
    __tablename__ = "demand_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    buyer_id: int = Field(foreign_key="buyers.id", index=True)
    produce_type: str = Field(index=True)
    quantity_required: float
    quantity_fulfilled: float = Field(default=0.0)
    maximum_price: float               # INR per kg – buyer's hard ceiling
    quality_requirement: str           # e.g. "A,B"  (comma-separated acceptable grades)
    delivery_deadline: datetime
    delivery_location: Optional[str] = None
    status: str = Field(default="open")   # open | partially_fulfilled | fulfilled | cancelled
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Vehicle
# ---------------------------------------------------------------------------
class Vehicle(SQLModel, table=True):
    __tablename__ = "vehicles"

    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_type: str                  # Truck | Van | Auto
    capacity_kg: float
    current_location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    availability_start: datetime
    availability_end: datetime
    cost_per_km: float                 # INR
    assigned_load_kg: float = Field(default=0.0)
    status: str = Field(default="available")  # available | assigned | unavailable


# ---------------------------------------------------------------------------
# Match Proposal (persisted so audit trail is available)
# ---------------------------------------------------------------------------
class MatchProposal(SQLModel, table=True):
    __tablename__ = "match_proposals"

    id: Optional[int] = Field(default=None, primary_key=True)
    batch_id: int = Field(foreign_key="inventory_batches.id", index=True)
    demand_id: int = Field(foreign_key="demand_requests.id", index=True)
    proposed_quantity: float
    proposed_price: float
    estimated_transport_cost: float
    platform_fee: float = Field(default=0.0)
    supplier_proceeds: float = Field(default=0.0)
    score: float
    status: str = Field(default="pending")  # pending | accepted | rejected | expired
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------
class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    proposal_id: Optional[int] = Field(default=None, foreign_key="match_proposals.id")
    buyer_id: int = Field(foreign_key="buyers.id", index=True)
    supplier_id: int = Field(foreign_key="suppliers.id", index=True)
    batch_id: int = Field(foreign_key="inventory_batches.id", index=True)
    vehicle_id: Optional[int] = Field(default=None, foreign_key="vehicles.id")
    quantity: float
    agreed_price: float                # INR per kg
    gross_value: float = Field(default=0.0)
    transport_cost: float = Field(default=0.0)
    platform_fee: float = Field(default=0.0)
    supplier_proceeds: float = Field(default=0.0)
    # State machine: proposed→confirmed→pickup_scheduled→picked_up→in_transit→delivered
    status: str = Field(default="proposed")
    confirmed_at: Optional[datetime] = None
    demand_id: Optional[int] = Field(default=None, foreign_key="demand_requests.id")
    pickup_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    delivered_quantity: Optional[float] = None
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Agent Event (audit log)
# ---------------------------------------------------------------------------
class AgentEvent(SQLModel, table=True):
    __tablename__ = "agent_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str = Field(index=True)   # surplus_detected | match_found | order_created | replanned | ...
    entity_id: Optional[int] = None       # ID of the primary entity involved
    entity_type: Optional[str] = None     # batch | order | vehicle | demand
    agent: str                            # coordinator | inventory | matching | logistics | recovery | rules
    summary: str                          # human-readable one-liner
    reason: Optional[str] = None
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Workflow Run (one event → one orchestrated workflow)
# ---------------------------------------------------------------------------
class WorkflowRun(SQLModel, table=True):
    __tablename__ = "workflow_runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_id: str = Field(index=True, unique=True)
    trigger_event: str = Field(index=True)  # new_stock | new_demand | vehicle_unavailable | ...
    entity_type: Optional[str] = None       # batch | demand | vehicle | order | proposal
    entity_id: Optional[int] = None
    status: str = Field(default="running", index=True)
    # running | awaiting_approval | completed | failed | needs_review
    requires_approval: bool = Field(default=False)
    approval_status: str = Field(default="not_required")
    # not_required | pending | approved | rejected | expired
    summary: str
    reason: Optional[str] = None
    payload: Optional[str] = None           # JSON
    validation_result: Optional[str] = None # JSON: rules checks, rejected candidates, revisions
    revised_plan: Optional[str] = None      # JSON
    proposal_ids: Optional[str] = None      # JSON list[int]
    proposals_created: int = Field(default=0)
    orders_created: int = Field(default=0)
    orders_updated: int = Field(default=0)
    started_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Workflow Step (tool calls, validation, plan, approval)
# ---------------------------------------------------------------------------
class WorkflowStep(SQLModel, table=True):
    __tablename__ = "workflow_steps"

    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_id: str = Field(index=True)
    step_number: int
    stage: str        # EVENT | DISCOVERY | TOOLS | RULES | PLAN | APPROVAL | EXECUTION | RESULT
    agent: str        # coordinator | inventory | matching | logistics | rules | recovery
    tool: Optional[str] = None
    status: str = Field(default="ok")  # ok | warning | rejected | failed | info
    summary: str
    details: Optional[str] = None      # JSON
    created_at: datetime = Field(default_factory=_now)
