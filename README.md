# TraceIQ — Evidence-Based Engineering Incident Investigator

> **Hackathon Track 2: RAG Engine | MongoDB Sponsor Critical Track**  
> An evidence-based engineering incident investigation platform built on **MongoDB Atlas** and **MongoDB Vector Search**.

---

## 1. Executive Product Vision

TraceIQ empowers engineering teams to investigate production incidents and complex systems degradations using their own technical knowledge base as grounded evidence. 

Rather than treating LLMs as speculative black boxes that hallucinate plausible causes, TraceIQ enforces strict evidentiary standards:
1. **Direct Measurements**: Telemetry metrics, connection wait times, saturation percentiles.
2. **Source-Reported Claims**: Explicit post-mortem statements and engineering runbooks.
3. **Inferences**: Deduced conclusions evaluated with controlled labels (*Supported*, *Plausible*, *Weakly supported*, *Contradicted*, *Insufficient evidence*).
4. **Unknowns / Missing Evidence**: Proactively identifies telemetry gaps and proposed diagnostic tests.
5. **Responsible Abstention**: Explicitly refuses to guess when questions exceed available knowledge.

TraceIQ is an **investigation assistant**, not an autonomous production remediation system.

---

## 2. Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Vanilla CSS with an editorial design aesthetic (Ivory background, Charcoal typography, Forest Green & Terracotta accents, thin borders, high readability).
- **Backend**: Node.js, Express, TypeScript, Zod environment & payload validation.
- **Database & Retrieval**: MongoDB Atlas, MongoDB Atlas Vector Search (`$vectorSearch`), MongoDB Atlas Search (`$search`), Reciprocal Rank Fusion (RRF).
- **AI & Grounding**: Google Gemini unified stack via `@google/genai` (Embeddings: `gemini-embedding-2` @ 1,536 dimensions; LLM: `gemini-3.5-flash`), with optional OpenAI / deterministic local fallback providers & strict server-side citation validation.
- **Deployment**: Vercel-compatible frontend, Render-compatible backend.

---

## 3. MongoDB Vector Search & Data Architecture

MongoDB is central to TraceIQ. The platform defines five core collections:

```
┌────────────────────────────────────────────────────────┐
│                   MongoDB Database: traceiq            │
├─────────────┬─────────────┬─────────────┬──────────────┤
│   sources   │   chunks    │  incidents  │investigations│
└─────────────┴─────────────┴─────────────┴──────────────┘
```

1. **`sources`**: Ingested document records, SHA-256 deduplication hashes, metadata, versioning, and status tracking.
2. **`chunks`**: Text passages, 1,536-dimensional embedding vectors, section headings, timestamps, and page numbers.
3. **`incidents`**: Production incidents (SEV-1 through SEV-4) linked to associated source records.
4. **`investigations`**: Completed evidence-backed investigation reports, hypotheses, observations, and citations.
5. **`evaluations`**: Evaluation benchmark runs, Recall@K, MRR, citation validity, and failure analyses.

### Atlas Vector Search Index Definition (`vector_index`)

Created on the `chunks` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "sourceId"
    },
    {
      "type": "filter",
      "path": "metadata.sourceType"
    },
    {
      "type": "filter",
      "path": "metadata.incidentDate"
    },
    {
      "type": "filter",
      "path": "metadata.isOutdated"
    },
    {
      "type": "filter",
      "path": "metadata.service"
    }
  ]
}
```

### Hybrid Retrieval & Reciprocal Rank Fusion (RRF)

TraceIQ executes both semantic similarity via Atlas `$vectorSearch` and exact token search via `$search` (with fallback to MongoDB `$text` search), combining candidate ranks using:

$$RRF\_score(d) = \sum_{m \in \{vector, lexical\}} \frac{1}{60 + rank_m(d)}$$

---

## 4. Ground-Truth Synthetic Demo Scenario

The seeded benchmark scenario models a real-world incident:

- **Incident ID**: `INC-2024-0882`
- **Title**: Checkout API Latency Spike & Cascading Connection Pool Exhaustion under Concurrent Load
- **Underlying Root Cause**: A deployment on Oct 12 capped the database connection pool at 10 connections. During a promotional traffic surge (4,800 req/sec), connection acquisition wait times exceeded the 5,000ms threshold (`ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54`), returning HTTP 504 Gateway Timeouts.
- **Competing Hypothesis**: Payment gateway timeout. Refuted by post-mortem telemetry showing payment response times stayed nominal (<180ms).
- **Outdated Source**: `OLD-SRE-RUNBOOK-2021.md` (Version 1.0, deprecated) claiming that latency is always caused by Stripe/PayPal. Flagged as outdated by the system.
- **Unanswerable Question**: "What was the memory utilization and cache eviction rate on the Redis cluster during the incident?" The system abstains responsibly because no Redis telemetry was captured.

---

## 5. Quickstart & Commands

### Prerequisites
- Node.js v18+ and npm.
- MongoDB Atlas cluster connection string (or local MongoDB for development).

### 1. Environment Setup

Create `.env` inside `backend/` (or copy from `.env.example`):

```bash
cp .env.example backend/.env
```

Set your MongoDB Atlas URI and Google Gemini API key:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/traceiq?retryWrites=true&w=majority
DB_NAME=traceiq
GEMINI_API_KEY=your_gemini_api_key_here
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIMENSIONS=1536
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash
```

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Run Automated Tests

```bash
npm test
```

### 4. Seed Ground-Truth Incident Data

```bash
npm run seed
```

### 5. Run the Benchmark Evaluation Suite

```bash
npm run eval
```

### 6. Start Development Servers

In terminal 1 (Backend - port 5000):
```bash
npm run backend:dev
```

In terminal 2 (Frontend - port 5173):
```bash
npm run frontend:dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Frontend Pages Overview

- **Overview (`/`)**: Real-time cluster health, total sources, vector chunks, index readiness, and recent incident investigations.
- **Investigation Workspace**: Formulate queries with source and time filters, view executive summaries, classified observations, controlled hypothesis assessments, and click citations to audit exact passages.
- **Source Library**: Ingest PDFs, Markdown notes, application logs, CSV performance snapshots, and SSRF-protected webpages. Reprocess or delete with cascading chunk cleanups.
- **Evidence Explorer**: Search chunks directly across vector, lexical, or hybrid modes with rank and score transparency.
- **Evaluation Lab**: Trigger live benchmark test runs, view Recall@K, MRR, citation validity, and failure analyses.
- **Investigation Reports**: Archive of past triage runs with full Markdown export capability.
- **Settings**: Complete index JSON definitions with one-click copy and provider readiness inspectors.

---

## 7. Security & SSRF Protection

- **SSRF Prevention**: All webpage imports resolve hostnames via DNS and reject loopback (`127.0.0.1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata IP (`169.254.169.254`).
- **Citation Provenance**: The system validates 100% of generated citation IDs against server-side chunk IDs, preventing LLM citation hallucinations.
- **Secrets Protection**: API keys and database credentials are strictly isolated in the backend environment.
