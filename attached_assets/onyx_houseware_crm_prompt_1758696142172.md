# Onyx Houseware Mini CRM — SQLite, Single Shared Admin

**Goal:** Build a tiny Zoho-Inventory–lite web app (Orders, Items, Customers, Indent) with **one shared admin login** (no signup). Admin creds come from environment variables, are **bcrypt-hashed and stored in DB** on first boot so we can add multi-user later if needed.

---

## Requirements
1. **Home/Dashboard**: Monthly order summary (counts, top items by pending qty).
2. **Items**: CRUD with fields → `name`, `sku (opt)`, `product_type`, `size_mm`, `ib_plate_size (opt)`, `price (opt)`, `safety_stock`.
3. **Indent**: Per-month opening balance + expected receipts; auto-calc:
   - `required_to_order = max(0, (pending_orders + safety_stock) - (opening_balance + expected_receipts))`
   - Pending orders = sum of order line qty for orders in `draft` or `confirmed` within selected month.
4. **Customers**: CRUD; include **po_number**; link customers to orders.
5. **Orders**: CRUD header + line items (`item`, `qty`, `unit_price?`), unique `po_number`, status flow: `draft | confirmed | fulfilled | cancelled`.
6. **Auth**: One shared admin; **login/logout only**; multiple concurrent sessions allowed; **no signup**. All `/api/*` routes require auth.

---

## Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: React (Vite) + TailwindCSS
- **Database**: **SQLite** via `better-sqlite3`
  - DB file at `server/data/onyx.db`
  - On startup execute:
    - `PRAGMA journal_mode=WAL;`
    - `PRAGMA busy_timeout=5000;`
  - Initialize schema from `server/schema.sql`; auto-run if tables missing.
- **Auth**: `express-session` (httpOnly cookie) + `bcryptjs` (saltRounds=12)
  - On boot, if `users` table is empty:
    - Read `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`
    - Hash password with bcrypt
    - Insert single admin user
  - No `/signup` route.
- **Validation**: Zod for all POST/PUT/PATCH payloads (return 422 on fail).
- **Build/Run**:
  - `npm run dev` → run server (port 3000) + client (port 5173) with proxy `/api/*`
  - `npm run build` → build client into `server/public` and serve via Express in production

---

## Environment (.env)
```bash
SESSION_SECRET=replace-with-long-random-string
ADMIN_USERNAME=onyx.admin
ADMIN_PASSWORD=choose-a-strong-password
NODE_ENV=development
```

---

## Directory Layout
```
/server
  index.js
  db.js
  schema.sql
  routes/
    auth.js
    items.js
    orders.js
    customers.js
    indents.js
    dashboard.js
  middleware/auth.js
  utils/migrations.js
  public/            # built client in prod
/client
  index.html
  src/
    main.jsx
    App.jsx
    lib/api.js
    pages/{Dashboard.jsx,Items.jsx,Orders.jsx,Customers.jsx,Indent.jsx,Admin.jsx,Login.jsx}
    components/{Nav.jsx,Table.jsx,FormModal.jsx,MonthPicker.jsx}
/shared/types.js     # Zod schemas & shared constants
```

---

## Schema (server/schema.sql)
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  po_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  product_type TEXT,
  size_mm INTEGER,
  ib_plate_size TEXT,
  price NUMERIC,
  safety_stock INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('draft','confirmed','fulfilled','cancelled')) DEFAULT 'draft',
  order_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS indents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,                -- format: YYYY-MM
  item_id INTEGER NOT NULL,
  opening_balance INTEGER DEFAULT 0,
  expected_receipts INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, item_id),
  FOREIGN KEY(item_id) REFERENCES items(id)
);
```

---

## API (JSON)
- **Auth**
  - `POST /api/auth/login` → `{ username, password }` → sets session
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- **Dashboard**
  - `GET /api/dashboard/summary?month=YYYY-MM` → totals + top items by pending qty
- **Items**
  - `GET /api/items` (q, active)
  - `GET /api/items/:id`
  - `POST /api/items`
  - `PUT /api/items/:id`
  - `DELETE /api/items/:id` (soft delete: `is_active=0`)
- **Customers**
  - `GET /api/customers` (q)
  - `GET /api/customers/:id`
  - `POST /api/customers`
  - `PUT /api/customers/:id`
  - `DELETE /api/customers/:id`
- **Orders**
  - `GET /api/orders` (status, customer_id, po_number, date range)
  - `GET /api/orders/:id` (include lines)
  - `POST /api/orders` → header + `items: [{item_id, qty, unit_price?}]`
  - `PUT /api/orders/:id` (replace lines)
  - `PATCH /api/orders/:id/status` → `{ status }`
  - `DELETE /api/orders/:id`
- **Indents**
  - `GET /api/indents?month=YYYY-MM` → per item: `{ opening_balance, expected_receipts, pending_order_qty, safety_stock, required_to_order }`
  - `POST /api/indents` → `{ month, rows: [{ item_id, opening_balance, expected_receipts?, notes? }] }`
  - `PUT /api/indents/:id`

---

## Boot Logic (server/index.js outline)
- Open SQLite with `better-sqlite3`
- Run PRAGMAs (`WAL`, `busy_timeout`)
- Apply `schema.sql` if tables missing
- If `SELECT COUNT(*) FROM users` = 0:
  - Read `ADMIN_USERNAME` & `ADMIN_PASSWORD` from env
  - Hash password with bcrypt (12 rounds)
  - Insert single admin user
  - If env missing → throw startup error
- Start Express with:
  - Helmet, CORS (vite dev), express.json()
  - `express-session` (httpOnly cookie, `sameSite=lax`, `secure:true` in prod HTTPS)
  - Static serve `server/public` in production
  - Auth middleware to protect `/api/*` (except `/api/auth/*`)

---

## Acceptance Criteria
- App boots only if admin creds exist (or are seeded on first boot).
- Multiple concurrent sessions with the **same** admin creds work.
- All non-auth routes require a valid session.
- Dashboard shows correct monthly summary.
- Items/Customers/Orders full CRUD works with validation.
- Indent page computes **required_to_order** correctly and supports inline edits + save.

---

## Notes
- Keep code clean and well-commented.
- Make sensible defaults where unspecified; document assumptions inline.
- Design should be simple and fast (Tailwind). Focus on usability over flair.
