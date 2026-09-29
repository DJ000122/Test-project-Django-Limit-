# Fleet maintenance API

Django/DRF backend and a Next.js UI for the take-home in [CHALLENGE.md](CHALLENGE.md).

Stack: Django 5.2, DRF, SimpleJWT, SQLite. Frontend: Next.js 16, MUI, React Query.

Demo recording: `fleet-tracker-demo.mp4` (sent separately).

## Run locally

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # mac/linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_fleet
python manage.py runserver
```

`seed_fleet` loads sample data and creates login **demo** / **fleet-demo-2026** (skip with `--no-demo-user`, rebuild with `--flush`).

API: http://localhost:8000/api/ — JWT on almost all routes. For the browsable API, log in at http://localhost:8000/api-auth/login/ first.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

http://localhost:3000 — override with `NEXT_PUBLIC_API_BASE_URL` if needed.

## Tests

```bash
cd backend
python manage.py test fleet
```

Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Auth

- `POST /api/auth/token/` — `{username, password}` → access + refresh + user
- `POST /api/auth/token/refresh/`
- `POST /api/auth/logout/` — blacklists refresh token
- `GET /api/auth/me/`

Send `Authorization: Bearer <access>` on other calls. Access lifetime is 15 minutes; refresh rotates and blacklists the old one. Login throttled to 10/min per IP.

The SPA stores tokens in localStorage and refreshes on 401. Route guard is UX only — the API still enforces auth.

## API (summary)

| What | Where |
| --- | --- |
| CRUD | `/api/offices/`, `/api/vehicles/`, `/api/mechanics/`, `/api/maintenance-records/` |
| Office report | `GET /api/offices/summary/` |
| Vehicle search | `GET /api/vehicles/` (filters + `search`, `ordering`, `page`, `page_size` ≤ 200) |
| Vehicle detail + full history | `GET /api/vehicles/{id}/` |
| Paginated history | `GET /api/vehicles/{id}/maintenance/` |
| Assign office | `POST /api/vehicles/{id}/assign/` body `{"office": id}` |
| Mechanic workload (this year) | `GET /api/mechanics/workload/` |
| Overdue / never serviced | `GET /api/vehicles/needs-maintenance/` |
| Duplicate VIN/plate check | `GET /api/vehicles/check-duplicate/` |
| Filter dropdowns | `GET /api/vehicles/facets/`, `GET /api/maintenance-types/` |

Validation errors are field-keyed 400s; protected deletes 409.

## Notes / assumptions

- Uniqueness (VIN, active plate, cert number) is in the DB and checked again in serializers.
- Vehicle detail uses prefetch so query count stays at 2 even with a long history. Search uses `EXISTS` for maintenance filters.
- “Last 12 months” = same calendar day one year ago through today (Feb 29 → Feb 28). Workload = Jan 1 through today.
- Office stats use the vehicle’s current office; no assignment history table.
- Overdue means more than 365 days since last service; never serviced sorts first.
- VIN/plate normalized on write (uppercase, strip junk from plates).
- JSON is snake_case to match the challenge examples.
- Overdue badges on the frontend duplicate the server rule in `lib/maintenance-status.ts`.
