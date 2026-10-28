"""
Seed realistic demo data for MandiPulse AI.
Run once to populate the database with suppliers, buyers, inventory,
demand requests, vehicles, and initial agent events.
"""

from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from .database import engine, create_db_and_tables
from .models import (
    Supplier, Buyer, InventoryBatch, DemandRequest, Vehicle, AgentEvent
)


SUPPLIERS = [
    {"name": "Sharma Tomato Farm", "location": "Nashik, MH", "lat": 19.9975, "lng": 73.7898, "contact": "+91-98201-11111"},
    {"name": "Patel Potato Traders", "location": "Agra, UP", "lat": 27.1767, "lng": 78.0081, "contact": "+91-98201-22222"},
    {"name": "Green Valley Onions", "location": "Pune, MH", "lat": 18.5204, "lng": 73.8567, "contact": "+91-98201-33333"},
    {"name": "Punjab Fresh Spinach", "location": "Ludhiana, PB", "lat": 30.9010, "lng": 75.8573, "contact": "+91-98201-44444"},
    {"name": "KR Banana Orchards", "location": "Coimbatore, TN", "lat": 11.0168, "lng": 76.9558, "contact": "+91-98201-55555"},
]

BUYERS = [
    {"name": "Mumbai Retail Mart", "buyer_type": "retailer", "location": "Mumbai, MH", "lat": 19.0760, "lng": 72.8777, "contact": "+91-99100-11111"},
    {"name": "IIT Bombay Hostel Kitchen", "buyer_type": "kitchen", "location": "Powai, MH", "lat": 19.1334, "lng": 72.9133, "contact": "+91-99100-22222"},
    {"name": "FreshMart Superstore", "buyer_type": "retailer", "location": "Thane, MH", "lat": 19.2183, "lng": 72.9781, "contact": "+91-99100-33333"},
    {"name": "Hotel Grand Catering", "buyer_type": "kitchen", "location": "Pune, MH", "lat": 18.5204, "lng": 73.8567, "contact": "+91-99100-44444"},
    {"name": "Quick Grocery Chain", "buyer_type": "retailer", "location": "Nashik, MH", "lat": 19.9975, "lng": 73.7898, "contact": "+91-99100-55555"},
]

VEHICLES = [
    {"vehicle_type": "Refrigerated Truck", "capacity_kg": 5000, "current_location": "Nashik, MH", "lat": 19.9975, "lng": 73.7898, "cost_per_km": 12.0},
    {"vehicle_type": "Mini Van", "capacity_kg": 800, "current_location": "Pune, MH", "lat": 18.5204, "lng": 73.8567, "cost_per_km": 7.0},
    {"vehicle_type": "Pickup Truck", "capacity_kg": 2000, "current_location": "Mumbai, MH", "lat": 19.0760, "lng": 72.8777, "cost_per_km": 9.5},
    {"vehicle_type": "Refrigerated Truck", "capacity_kg": 4000, "current_location": "Agra, UP", "lat": 27.1767, "lng": 78.0081, "cost_per_km": 11.0},
    {"vehicle_type": "Mini Van", "capacity_kg": 600, "current_location": "Thane, MH", "lat": 19.2183, "lng": 72.9781, "cost_per_km": 6.5},
]

now = datetime.now(timezone.utc)


def _batches(supplier_ids):
    return [
        # Tomatoes – high urgency (expires in 24 h)
        dict(supplier_id=supplier_ids[0], produce_type="Tomatoes", quantity_available=500.0,
             quality_grade="B", asking_price=18.0, usable_until=now + timedelta(hours=24), min_sale_quantity=50.0, status="available"),
        # Tomatoes – low urgency
        dict(supplier_id=supplier_ids[0], produce_type="Tomatoes", quantity_available=200.0,
             quality_grade="A", asking_price=22.0, usable_until=now + timedelta(hours=72), min_sale_quantity=30.0, status="available"),
        # Potatoes
        dict(supplier_id=supplier_ids[1], produce_type="Potatoes", quantity_available=1000.0,
             quality_grade="A", asking_price=14.0, usable_until=now + timedelta(days=7), min_sale_quantity=100.0, status="available"),
        # Onions
        dict(supplier_id=supplier_ids[2], produce_type="Onions", quantity_available=750.0,
             quality_grade="B", asking_price=20.0, usable_until=now + timedelta(days=5), min_sale_quantity=50.0, status="available"),
        # Spinach – very urgent
        dict(supplier_id=supplier_ids[3], produce_type="Spinach", quantity_available=120.0,
             quality_grade="A", asking_price=30.0, usable_until=now + timedelta(hours=8), min_sale_quantity=10.0, status="available"),
        # Bananas
        dict(supplier_id=supplier_ids[4], produce_type="Bananas", quantity_available=600.0,
             quality_grade="A", asking_price=25.0, usable_until=now + timedelta(days=3), min_sale_quantity=50.0, status="available"),
    ]


def _demands(buyer_ids):
    return [
        dict(buyer_id=buyer_ids[0], produce_type="Tomatoes", quantity_required=200.0,
             maximum_price=22.0, quality_requirement="A,B", delivery_deadline=now + timedelta(hours=20), delivery_location="Mumbai, MH"),
        dict(buyer_id=buyer_ids[1], produce_type="Tomatoes", quantity_required=150.0,
             maximum_price=20.0, quality_requirement="B", delivery_deadline=now + timedelta(hours=18), delivery_location="Powai, MH"),
        dict(buyer_id=buyer_ids[2], produce_type="Potatoes", quantity_required=500.0,
             maximum_price=16.0, quality_requirement="A,B", delivery_deadline=now + timedelta(days=2), delivery_location="Thane, MH"),
        dict(buyer_id=buyer_ids[3], produce_type="Onions", quantity_required=300.0,
             maximum_price=22.0, quality_requirement="A,B", delivery_deadline=now + timedelta(days=3), delivery_location="Pune, MH"),
        dict(buyer_id=buyer_ids[4], produce_type="Bananas", quantity_required=200.0,
             maximum_price=28.0, quality_requirement="A", delivery_deadline=now + timedelta(days=2), delivery_location="Nashik, MH"),
        dict(buyer_id=buyer_ids[2], produce_type="Spinach", quantity_required=80.0,
             maximum_price=35.0, quality_requirement="A", delivery_deadline=now + timedelta(hours=6), delivery_location="Thane, MH"),
    ]


def seed():
    create_db_and_tables()

    with Session(engine) as db:
        # Skip if already seeded
        existing = db.exec(select(Supplier)).first()
        if existing:
            print("Database already seeded. Skipping.")
            return

        # ----- Suppliers -----
        supplier_objs = []
        for s in SUPPLIERS:
            obj = Supplier(**s)
            db.add(obj)
            supplier_objs.append(obj)
        db.commit()
        for o in supplier_objs:
            db.refresh(o)
        s_ids = [o.id for o in supplier_objs]

        # ----- Buyers -----
        buyer_objs = []
        for b in BUYERS:
            obj = Buyer(**b)
            db.add(obj)
            buyer_objs.append(obj)
        db.commit()
        for o in buyer_objs:
            db.refresh(o)
        b_ids = [o.id for o in buyer_objs]

        # ----- Vehicles -----
        avail_start = now - timedelta(hours=2)
        avail_end = now + timedelta(days=14)
        for v in VEHICLES:
            obj = Vehicle(**v, availability_start=avail_start, availability_end=avail_end)
            db.add(obj)
        db.commit()

        # ----- Inventory Batches -----
        for batch_data in _batches(s_ids):
            db.add(InventoryBatch(**batch_data))
        db.commit()

        # ----- Demand Requests -----
        for demand_data in _demands(b_ids):
            db.add(DemandRequest(**demand_data))
        db.commit()

        # ----- Initial Agent Events -----
        events = [
            AgentEvent(event_type="system_startup", entity_type="system", agent="coordinator",
                       summary="MandiPulse AI system initialized with seed data",
                       new_state="running"),
            AgentEvent(event_type="surplus_detected", entity_id=1, entity_type="batch", agent="inventory",
                       summary="500 kg Tomatoes detected as high-urgency surplus (expires <24 h)",
                       new_state="at_risk"),
            AgentEvent(event_type="surplus_detected", entity_id=5, entity_type="batch", agent="inventory",
                       summary="120 kg Spinach flagged — expires in 8 h, no buyer assigned yet",
                       new_state="critical"),
        ]
        for ev in events:
            db.add(ev)
        db.commit()

        print("✅ Seed complete: 5 suppliers, 5 buyers, 6 inventory batches, 6 demand requests, 5 vehicles seeded.")


if __name__ == "__main__":
    seed()
