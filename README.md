# 🌾 MandiPulse AI — Agentic Food Supply & Surplus Balancing Platform

MandiPulse AI is an autonomous, agentic agricultural supply-chain coordination network that balances farm surplus produce and commercial buyer demand in **real-time**, slashing food spoilage and guaranteeing verified farm-fresh logistics dispatch.

---

## 🚀 Key Highlights & Real-Time Flow

1. **Real-Time Surplus Listing (Producers/Sellers)**:
   - Farmers/Sellers list fresh surplus batches specifying produce type, quantity (kg), asking price (₹/kg), quality grade (A/B/C), and shelf-life urgency.
   - Triggers automated batch-splitting algorithms and real-time notifications to connected buyers.

2. **Real-Time Procurement & Instant Buying (Commercial Buyers)**:
   - **Live Market Feed (Stream active every 3.5s)**: Live surplus lots posted by farmers appear in real-time on the Buyer Dashboard without manual refresh.
   - **⚡ One-Click Instant Buy**: Buyers can directly procure any live surplus lot with dynamic cost breakdowns (produce value + estimated cold-chain transport + 2% platform fee) and automated nearest vehicle allocation.
   - **⚡ Real-Time Auto-Procure**: When enabled, the system automatically accepts & purchases any surplus matching the buyer's price ceiling and acceptable quality grades the moment a farmer uploads it.

3. **Multi-Agent Coordination & Autonomous Logistics**:
   - **Coordinator Agent**: Oversees platform lifecycle, coordinates order confirmation, reserves inventory, and manages audit trails.
   - **Matching Agent**: Multi-buyer proportional batch splitting ensuring surplus is distributed efficiently across competing demands.
   - **Logistics Agent**: Checks vehicle capacity, cost per km, ETA, and validates delivery feasibility against produce freshness deadlines.
   - **Recovery Agent**: Handles breakdowns, driver cancellations, and buyer cancellations by re-routing orders to standby vehicles in real time.

4. **Dual-Engine Architecture (FastAPI + n8n)**:
   - Built-in zero-dependency Python autonomous agent engine in FastAPI that works 24/7 out of the box.
   - Full integration with **n8n AI Agents** (powered by OpenAI `gpt-4o-mini` with LangChain tools).

---

## 🤖 n8n Workflow Automation

The repository includes two production-ready n8n agent workflows:

### 1. Surplus Matching Agent (`n8n_mandipulse_surplus_matching_agent.json`)
* **Trigger**: Webhook at `POST /webhook/mandipulse-inventory` (fired automatically by backend upon inventory creation).
* **AI Model**: OpenAI Chat Model (`gpt-4o-mini`, temperature 0.1).
* **Tools Used**:
  - `get_available_inventory`: Reads available surplus produce batches (`GET /api/inventory/available`).
  - `get_open_demands`: Reads active buyer requirements and price ceilings (`GET /api/demands/open`).
  - `find_feasible_matches`: Calculates proportional supplier-to-buyer matches (`POST /api/matches/preview`).
  - `check_vehicle_availability`: Checks active vehicle capacities and cost (`GET /api/vehicles/available`).
  - `create_match_proposal`: Saves proposals to the backend database (`POST /api/matches/proposals`).
  - `record_agent_event`: Logs reasoning and audit trail (`POST /api/agents/events`).
* **Objective**: Automatically reviews every newly listed produce batch, matches against open demands, reserves transport, and proposes transactions.

### 2. Disruption Recovery Agent (`n8n_mandipulse_disruption_recovery_agent.json`)
* **Trigger**: Webhook at `POST /webhook/mandipulse-disruption` (fired upon vehicle breakdown or cancellation).
* **AI Model**: OpenAI Chat Model (`gpt-4o-mini`).
* **Tools Used**:
  - `check_vehicle_availability`: Queries standby replacement vehicles (`GET /api/vehicles/available`).
  - `mark_vehicle_unavailable`: Disables broken down vehicles (`POST /vehicles/{id}/unavailable`).
  - `record_agent_event`: Records replanning decisions into the audit timeline (`POST /api/agents/events`).
* **Objective**: Replans affected in-transit deliveries to ensure produce arrives before the freshness deadline.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, FastAPI, SQLModel / SQLAlchemy, SQLite, Pydantic
- **Frontend**: React 19, Vite, Vanilla CSS design system, Lucide Icons
- **Workflow Automation**: n8n, LangChain, OpenAI GPT-4o-mini
- **Real-Time Layer**: Polling synchronization & Webhook event broadcasting

---

## 🏃 Running Locally

### 1. Backend (FastAPI)
```bash
# Activate virtualenv
source venv/bin/activate

# Install dependencies (if needed)
pip install fastapi sqlmodel uvicorn requests pydantic

# Run server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API runs at: `http://localhost:8000`  
Interactive Swagger Docs: `http://localhost:8000/docs`

### 2. Frontend (React + Vite)
```bash
# Install packages
npm install

# Start Vite dev server
npm run dev
```
Frontend runs at: `http://localhost:5173`

### 3. n8n (Optional Workflow Runner)
```bash
# Run n8n locally
npx n8n
```
1. Open `http://localhost:5678`.
2. Import `n8n_mandipulse_surplus_matching_agent.json` and `n8n_mandipulse_disruption_recovery_agent.json`.
3. Add your OpenAI API credential to the OpenAI Chat Model node.
4. Activate the workflows.
