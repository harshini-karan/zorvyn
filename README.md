# Finance Data Processing and Access Control Backend

This project implements a backend for a finance dashboard with:

- Role-based access control (`viewer`, `analyst`, `admin`)
- User management
- Financial record CRUD and filtering
- Dashboard summary and trend analytics
- Input validation and consistent error responses
- SQLite persistence
- JWT-based authentication

## Tech Stack

- Node.js + Express
- SQLite (`better-sqlite3`)
- Validation with `zod`

## Run Locally

```bash
npm install
npm run dev
```

Server starts on `http://localhost:4000`.

You can copy `.env.example` to `.env` and customize values for local runs.

## Authentication Model (JWT)

This backend issues JWT access tokens via login:

- `POST /auth/login`

Use returned token for protected routes:

- `Authorization: Bearer <token>`

Seed users are created on first run:

- admin: `admin@finance.local` / `Admin@123`
- analyst: `analyst@finance.local` / `Analyst@123`
- viewer: `viewer@finance.local` / `Viewer@123`

Inactive users are blocked.

## API Overview

### Public

- `GET /health`
- `POST /auth/login`

### Authenticated Utility

- `GET /me`

### User Management (`admin` only)

- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`

User payload:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "StrongPass123",
  "role": "analyst",
  "status": "active"
}
```

### Financial Records

- `GET /records` (`analyst`, `admin`)
- `GET /records/:id` (`analyst`, `admin`)
- `POST /records` (`admin`)
- `PATCH /records/:id` (`admin`)
- `DELETE /records/:id` (`admin`)

Record payload:

```json
{
  "amount": 2400.5,
  "type": "income",
  "category": "salary",
  "date": "2026-04-01",
  "notes": "April salary"
}
```

Filter query params for `GET /records`:

- `type=income|expense`
- `category=<category>`
- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`

### Dashboard APIs (`viewer`, `analyst`, `admin`)

- `GET /dashboard/summary`
- `GET /dashboard/trends?period=monthly|weekly`

Optional date filters for both endpoints:

- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`

`/dashboard/summary` includes:

- `totalIncome`
- `totalExpenses`
- `netBalance`
- `categoryTotals`
- `recentActivity` (top 5)

## Example cURL

Login as admin:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@finance.local","password":"Admin@123"}'
```

Create a record as admin (replace `<TOKEN>`):

```bash
curl -X POST http://localhost:4000/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"amount":1200,"type":"income","category":"freelance","date":"2026-04-05","notes":"Invoice payout"}'
```

Fetch dashboard summary as viewer (replace `<TOKEN>`):

```bash
curl http://localhost:4000/dashboard/summary -H "Authorization: Bearer <TOKEN>"
```

## Automated Tests

Run test suite (Jest + Supertest):

```bash
npm test
```

Tests cover RBAC behavior and dashboard summary calculations.

## Docker (One-Command Local Run)

Build and run API with Docker Compose:

```bash
docker compose up --build
```

API will be available at `http://localhost:4000`.

Persistent SQLite data is stored in the compose volume `finance-data`.

## Access Control Matrix

- `viewer`: dashboard read only
- `analyst`: records read + dashboard read
- `admin`: full users and records management + dashboard read

## Assumptions

- Dates are sent in ISO `YYYY-MM-DD` format.
- Authentication uses JWT access tokens from `POST /auth/login`.
- Physical deletes are allowed for users and records in this assignment scope.
