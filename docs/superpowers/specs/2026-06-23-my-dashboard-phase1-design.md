# My Dashboard — Phase 1: Foundation Design Spec

**Date:** 2026-06-23  
**Author:** Tausif Ansari (Mass Call Net)  
**Status:** Approved for implementation  
**Scope:** Phase 1 — Core Platform Infrastructure only

---

## 1. Overview

My Dashboard is a production-ready, enterprise multi-tenant analytics platform for Mass Call Net. It replaces Power BI dashboards with a custom web application that supports multiple clients (Bellavita, GNC, Clovia, etc.) with complete data isolation.

Phase 1 delivers the foundation: authentication, role-based access control, multi-tenancy, super admin portal, and the animated dashboard launcher. No analytics data is displayed in Phase 1 — that is Phase 2 (Call Master) onward.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + ShadCN UI |
| Animation | Framer Motion |
| State | Zustand |
| Icons | Lucide React |
| HTTP client | Axios (with interceptors) |
| Backend | Node.js + Express.js |
| ORM | Prisma |
| Database | MySQL — database: `shivamgiri` |
| Auth | JWT (access) + httpOnly cookie (refresh) |

---

## 3. Repository Structure

Single monorepo with npm workspaces.

```
my-dashboards/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/           # login, forgot-password, reset-password pages
│   │   │   ├── dashboard/      # launcher home
│   │   │   ├── admin/          # clients, users, processes, access management
│   │   │   ├── profile/        # profile page + change password
│   │   │   └── settings/       # app settings
│   │   ├── components/         # shared ShadCN + custom UI components
│   │   ├── store/              # Zustand slices (auth, ui, notifications)
│   │   ├── hooks/              # custom React hooks
│   │   ├── lib/                # axios instance, utils, constants, date helpers
│   │   ├── types/              # shared TypeScript interfaces
│   │   └── router/             # React Router config, route guards, lazy routes
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # routes, controller, service (login, refresh, logout, forgot, reset)
│   │   │   ├── clients/        # CRUD for md_clients
│   │   │   ├── users/          # CRUD for md_users
│   │   │   ├── processes/      # CRUD for md_processes + md_user_process_mapping
│   │   │   ├── dashboards/     # md_dashboards + md_dashboard_access management
│   │   │   └── audit/          # read-only audit log + login history endpoints
│   │   ├── middleware/
│   │   │   ├── verifyToken.ts  # JWT validation
│   │   │   ├── injectTenant.ts # extracts clientId from JWT → req.tenantId
│   │   │   └── requireRole.ts  # role guard factory
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts         # seed roles, dashboards, all 22 processes
│   │   ├── lib/
│   │   │   ├── token.ts        # sign/verify JWT helpers
│   │   │   ├── mailer.ts       # Nodemailer for password reset
│   │   │   └── logger.ts       # winston logger
│   │   └── app.ts              # Express entry point
│   ├── .env
│   └── package.json
├── .gitignore
└── package.json                # root (npm workspaces)
```

---

## 4. Database Schema

**Database:** `shivamgiri`  
**Convention:** All tables prefixed `md_`  
**Source tables** (`db_audit.call_quality_assessment`, `db_external.CallDetails`) are read-only and untouched.

### 4.1 Tables

#### `md_roles`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| name | ENUM('super_admin','client_admin','manager','qa') | |
| display_name | VARCHAR(50) | e.g. "Super Admin" |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### `md_clients`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| name | VARCHAR(100) | e.g. "Bellavita" |
| dialdesk_client_id | INT UNIQUE | e.g. 375 |
| logo_url | VARCHAR(255) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | |

#### `md_users`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| name | VARCHAR(100) | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| role_id | INT FK → md_roles | |
| client_id | INT FK → md_clients | NULL for super_admin |
| is_active | BOOLEAN | DEFAULT TRUE |
| last_login | TIMESTAMP | nullable |
| created_at | TIMESTAMP | |

#### `md_processes`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| client_id | INT FK → md_clients | |
| process_name | VARCHAR(100) | e.g. "Bellavita" |
| lob | ENUM('Inbound','Outbound','IB/OB') | |
| dialdesk_client_id | INT | mirrors md_clients.dialdesk_client_id |
| is_active | BOOLEAN | DEFAULT TRUE |

#### `md_dashboards`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| name | VARCHAR(100) | e.g. "Call Master" |
| slug | VARCHAR(100) UNIQUE | e.g. "call-master" |
| icon | VARCHAR(50) | Lucide icon name |
| description | TEXT | |
| is_active | BOOLEAN | DEFAULT TRUE |
| sort_order | INT | DEFAULT 0 |

#### `md_dashboard_access`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → md_users | |
| dashboard_id | INT FK → md_dashboards | |
| can_export | BOOLEAN | DEFAULT FALSE |
| granted_by | INT | user_id of admin who granted |
| granted_at | TIMESTAMP | |

#### `md_user_process_mapping`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → md_users | |
| process_id | INT FK → md_processes | |
| assigned_at | TIMESTAMP | |

#### `md_login_logs`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → md_users | |
| ip_address | VARCHAR(45) | supports IPv6 |
| user_agent | TEXT | |
| status | ENUM('success','failed') | |
| logged_at | TIMESTAMP | |

#### `md_audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| user_id | INT FK → md_users | |
| action | VARCHAR(100) | e.g. "CREATE_USER" |
| entity_type | VARCHAR(50) | e.g. "client" |
| entity_id | INT | nullable |
| old_values | JSON | nullable |
| new_values | JSON | nullable |
| created_at | TIMESTAMP | |

### 4.2 Multi-Tenancy Rule

- `super_admin` users have `client_id = NULL` → see all data
- All other roles have `client_id` set → see only their client's data
- The `injectTenant` middleware reads `clientId` from the JWT payload and sets `req.tenantId`
- Every Prisma query in every service adds `where: { clientId: req.tenantId }` (except super_admin, where tenantId is null and the filter is omitted)
- No exceptions — tenant filtering is enforced at the service layer, not the route layer

### 4.3 Seed Data

The `seed.ts` script populates:
- 4 roles (super_admin, client_admin, manager, qa)
- 6 dashboards (Call Master, Quality, Sales, Client, Operations, Agent — all inactive except Call Master)
- 22 processes from the process mapping table in the spec, with correct `dialdesk_client_id` values
- 1 default super admin user (email from `.env`, password hashed)

---

## 5. Authentication

### 5.1 Token Strategy

| Token | Expiry | Storage |
|---|---|---|
| Access Token (JWT) | 15 minutes | Zustand memory only (never localStorage) |
| Refresh Token (JWT) | 7 days | httpOnly + Secure cookie |

JWT payload: `{ id, email, role, clientId, iat, exp }`

### 5.2 API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | Public | Email + password → tokens |
| POST | /api/auth/refresh | Cookie | Issue new access token |
| POST | /api/auth/logout | Bearer | Clear cookie + invalidate |
| POST | /api/auth/forgot-password | Public | Send reset email |
| POST | /api/auth/reset-password | Public | Validate token + set new password |
| GET | /api/auth/me | Bearer | Current user profile |
| PATCH | /api/auth/change-password | Bearer | Change own password |

### 5.3 Forgot Password Flow

1. User submits email → backend checks if user exists
2. Backend generates a signed JWT reset token (1 hour expiry, signed with `RESET_TOKEN_SECRET`)
3. Sends email via Nodemailer with link: `https://<domain>/reset-password/<token>`
4. User clicks link → frontend validates token with backend → allows new password entry
5. Backend verifies token signature + expiry → updates `password_hash`
6. No reset tokens stored in DB — the signed JWT is self-contained

### 5.4 Middleware Stack (per protected request)

```
verifyToken → injectTenant → requireRole(roles[]) → controller
```

### 5.5 Frontend Auth Flow

- Axios instance has a response interceptor: on 401, automatically calls `/api/auth/refresh`, retries original request once
- On refresh failure (expired refresh token) → clear Zustand auth state → redirect to `/login`
- `PrivateRoute` component wraps all protected routes — checks Zustand auth state + role

---

## 6. API Layer — Phase 1 Endpoints

### Clients (`/api/clients`) — super_admin only
- `GET /` — list all clients (paginated)
- `POST /` — create client
- `GET /:id` — get client detail
- `PATCH /:id` — update client
- `DELETE /:id` — soft delete (set is_active = false)

### Users (`/api/users`) — super_admin only
- `GET /` — list all users (paginated, filterable by role/client)
- `POST /` — create user (auto-generates temp password, sends email)
- `GET /:id` — get user detail
- `PATCH /:id` — update user
- `DELETE /:id` — soft delete
- `POST /:id/reset-password` — admin-triggered password reset

### Processes (`/api/processes`) — super_admin only
- `GET /` — list all processes
- `POST /` — create process
- `PATCH /:id` — update process
- `DELETE /:id` — soft delete
- `POST /assign-user` — assign process to user
- `DELETE /unassign-user` — remove assignment

### Dashboards (`/api/dashboards`) — super_admin only
- `GET /` — list all dashboards
- `GET /my` — dashboards assigned to current user (all roles)
- `POST /grant` — grant dashboard access to user
- `DELETE /revoke` — revoke dashboard access

### Audit (`/api/audit`) — super_admin only
- `GET /logs` — paginated audit log
- `GET /login-history` — login history (filterable by user/date/status)

---

## 7. UI Shell

### 7.1 Design System

| Token | Value |
|---|---|
| Primary | `#1E40AF` |
| Accent | `#F59E0B` |
| Success | `#10B981` |
| Danger | `#EF4444` |
| Background | `#F8FAFC` |
| Cards | `#FFFFFF` |
| Sidebar bg | `#0F172A` |
| Font | Fira Sans (body), Fira Code (monospace) |

### 7.2 Pages

| Route | Component | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/forgot-password` | ForgotPasswordPage | Public |
| `/reset-password/:token` | ResetPasswordPage | Public |
| `/dashboard` | DashboardLauncher | All roles |
| `/admin/clients` | ClientsPage | super_admin |
| `/admin/users` | UsersPage | super_admin |
| `/admin/processes` | ProcessesPage | super_admin |
| `/admin/access` | AccessPage | super_admin |
| `/profile` | ProfilePage | All roles |
| `/audit` | AuditPage | super_admin |

### 7.3 Framer Motion Animations

- **Login card:** fade + slide-up on mount
- **Dashboard launcher cards:** staggered fade-in (children stagger 0.08s)
- **Sidebar:** smooth width transition between expanded (240px) and collapsed (64px, icon-only)
- **Page transitions:** `AnimatePresence` with slide-fade between routes
- **Admin tables:** row hover lift effect (y: -1, shadow)
- **Modal / Drawer:** scale-in from 95% + fade
- **Buttons:** subtle scale on press (0.97)
- **Form fields:** focus ring animate-in

### 7.4 Sidebar Behaviour

- Sidebar is always visible on desktop (≥1024px), starts expanded
- Toggle button collapses to icon-only (64px wide)
- Preference stored in Zustand + localStorage (persists across sessions)
- On mobile (< 1024px): sidebar becomes a drawer overlay, closed by default

### 7.5 Dashboard Launcher

- Shows cards for all dashboards in `md_dashboards` where `is_active = true`
- Only shows cards the current user has access to (from `md_dashboard_access`)
- Super admin sees all active dashboards
- Future/inactive dashboards shown as greyed-out "Coming Soon" cards
- Clicking an active, accessible card navigates to that dashboard

---

## 8. Deployment

**Target:** VPS / Linux server  
**Process manager:** pm2  
**Web server:** nginx (reverse proxy)

### 8.1 Environment Variables (`backend/.env`)

```env
# Database
DB_HOST=122.184.128.90
DB_PORT=3306
DB_USER=root
DB_PASSWORD=vicidialnow
DB_NAME=shivamgiri
DATABASE_URL="mysql://root:vicidialnow@122.184.128.90:3306/shivamgiri"

# JWT
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<strong-random-secret>
REFRESH_TOKEN_EXPIRES_IN=7d
RESET_TOKEN_SECRET=<strong-random-secret>

# App
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:5173

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
SMTP_FROM="My Dashboard <noreply@masscallnet.in>"

# Super Admin seed
SEED_ADMIN_EMAIL=admin@masscallnet.in
SEED_ADMIN_PASSWORD=<initial-password>
```

### 8.2 pm2 Ecosystem

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'my-dashboard-api',
      script: 'dist/app.js',
      cwd: './backend',
      env_production: { NODE_ENV: 'production', PORT: 5000 }
    }
  ]
}
```

### 8.3 nginx Config (reverse proxy)

```nginx
server {
    listen 80;
    server_name dashboard.masscallnet.in;

    # Frontend (built static files)
    location / {
        root /var/www/my-dashboard/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 9. Security Checklist

- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] Access token in memory only (no localStorage)
- [x] Refresh token in httpOnly + Secure cookie
- [x] All API routes require JWT except public auth endpoints
- [x] Row-level tenant isolation enforced in service layer
- [x] SQL injection prevented via Prisma parameterized queries
- [x] CORS restricted to `FRONTEND_URL`
- [x] Rate limiting on `/api/auth/login` (max 10 req/min per IP)
- [x] Helmet.js for HTTP security headers
- [x] Input validation via Zod on all request bodies
- [x] Audit log written on every admin action (create/update/delete)
- [x] Login failures logged to `md_login_logs` with IP

---

## 10. Out of Scope for Phase 1

- Any analytics dashboards (Call Master, Quality, Sales, etc.) — Phase 2+
- Dark mode — Phase 4
- Export features — Phase 2+
- AI insights — Phase 4
- Data dictionary engine — Phase 2
- Mobile responsiveness below tablet — Phase 4
- Email scheduling / scheduled reports — Phase 4

---

## 11. Process Seed Data (all 22)

| Process Name | LOB | Dialdesk Client ID |
|---|---|---|
| Bellavita | Inbound | 375 |
| Bellavita | Outbound | 375 |
| Clovia | Inbound | 468 |
| GNC | Inbound | 409 |
| GNC | Outbound | 409 |
| Neeman's | Inbound | 475 |
| Neeman's | Outbound | 475 |
| Viega | Inbound | 352 |
| Exicom | Inbound | 326 |
| BirlaNu | Outbound | 477 |
| Du Digital BD | Inbound | 380 |
| Du Digital Korea | Inbound | 473 |
| Du Digital Thailand | Inbound | 474 |
| Reginald Men | Outbound | 481 |
| VST | Outbound | 489 |
| Wryze | Outbound | 471 |
| AW | IB/OB | 490 |
| Housing | Outbound | 413 |
| Solveesy | Outbound | 491 |
| B3 | Inbound | 486 |
| B3 | Outbound | 486 |
| Finfort | Outbound | 492 |
