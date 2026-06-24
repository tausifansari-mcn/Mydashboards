# My Dashboard Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Phase 1 foundation — monorepo, DB schema, JWT auth, RBAC, multi-tenant middleware, all backend API modules, and the full animated frontend (login, dashboard launcher, admin portal).

**Architecture:** Feature-module monorepo (npm workspaces). Express backend with Prisma ORM against MySQL `shivamgiri` database. React+Vite frontend with Zustand state, Axios interceptors for token refresh, and Framer Motion animations. Tenant isolation via middleware that reads `clientId` from JWT and scopes every Prisma query.

**Tech Stack:** Node 24 / Express / Prisma / MySQL — React 18 / Vite / TypeScript / Tailwind CSS / ShadCN UI / Framer Motion / Zustand / Axios / Lucide React

---

## Task 1: Monorepo Root Setup
## Task 2: Backend Scaffold
## Task 3: Prisma Schema + Seed
## Task 4: Backend Lib
## Task 5: Middleware
## Task 6: Auth Module
## Task 7: Clients Module
## Task 8: Users Module
## Task 9: Processes Module
## Task 10: Dashboards Module
## Task 11: Audit Module
## Task 12: Frontend Scaffold
## Task 13: Stores + Axios + Types
## Task 14: Router + Shell + Sidebar
## Task 15: Auth Pages
## Task 16: Dashboard Launcher
## Task 17: Admin Pages
## Task 18: Profile + Audit Pages
## Task 19: Final Wiring + Commit
