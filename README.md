# Hotel Rate Comparator

Searches two mock hotel suppliers in parallel via a Temporal workflow, and
returns the single cheapest rate. Frontend is React/Vite; backend is
Node/TypeScript + Temporal.

## Prerequisites

- Node.js 18+ and npm
- [Temporal CLI](https://docs.temporal.io/cli#install) — on Windows:
  ```powershell
  winget install --id Temporal.TemporalCLI --exact
  ```
  Close and reopen your terminal afterward, then confirm with:
  ```powershell
  temporal --version
  ```

## Install

```bash
cd hotel-rate-comparator
npm install
```

No `.env` file is required — everything has working defaults. See
`backend/.env.example` / `frontend/.env.example` if you want to override
ports or URLs.

## Run it (4 terminals, in this order)

**1. Temporal dev server** (any directory)
```bash
temporal server start-dev
```
Web UI at `http://localhost:8233`.

**2. Mock supplier server**
```bash
cd backend
npm run dev:mock-suppliers
```

**3. Temporal worker** — executes the actual workflow
```bash
cd backend
npm run dev:worker
```

**4. API server**
```bash
cd backend
npm run dev:api
```

**5. Frontend** (separate terminal)
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173`.

## Test it directly (optional, skips the UI)

```bash
curl -X POST http://localhost:4000/api/search-hotels \
  -H "Content-Type: application/json" \
  -d '{"city":"Paris","checkIn":"2026-10-01","checkOut":"2026-10-05"}'
```

To force a specific supplier scenario (`normal`, `delay`, `timeout`, `empty`,
`error`, `flaky`), add `"supplierAScenario"` / `"supplierBScenario"` to the
body.

## Run tests

```bash
cd backend
npm test
```
Self-contained — no running processes required. Covers every scenario:
A/B cheaper, tie, one/both fail, one/both empty, slow-supplier cancellation,
retry-then-succeed, and mid-search cancellation.

## One-shot verification

```bash
./verify.sh
```
Runs install → backend typecheck → frontend build → backend tests.

CI (`.github/workflows/ci.yml`) runs the same pipeline automatically on
every push once this is on GitHub.

## Notes

- The app returns **one** hotel per search — the cheapest of the two
  suppliers — not a side-by-side list. That's by design, not a bug.
- On ties, Supplier A wins deterministically.
- If a supplier hasn't responded in 5s, the workflow cancels it and proceeds
  with the other result.

## Known limitations & assumptions

- **Tie-break**: same-price ties resolve to Supplier A (per the spec's own
  example), implemented by placing A's results first in the combined list.
- **5s timeout vs. retries**: the per-supplier 5s cancellation window wraps
  the activity's own retries (500ms initial backoff, up to 4 attempts). A
  supplier that's both slow *and* flaky could be cancelled before a later
  retry succeeds — in production you'd tune these two knobs against real
  supplier SLAs.
- **`supplierAScenario`/`supplierBScenario`** are testing-only fields; the
  frontend form never sends them. They exist so scenario tests and manual
  curl calls can force specific mock-supplier behavior on demand.
- **No persistence layer** — hotel data is generated pseudo-randomly per mock
  supplier call. Swapping in real suppliers only requires changing the base
  URL/auth in `backend/src/activities.ts`.
- **Cancel endpoint exists but isn't wired into the UI.**
  `POST /api/search-hotels/:workflowId/cancel` is implemented and covered by
  a workflow test, but there's no "Cancel search" button in the frontend yet.
- **No auth or rate limiting** on the API — out of scope for this exercise.
- **Single implicit currency** (e.g. USD) — suppliers don't return currency
  codes.
