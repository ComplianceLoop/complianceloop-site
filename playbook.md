# ComplianceLoop Playbook

<!-- CL:START -->
# ComplianceLoop — Canonical Plan (Generated)

**Repo:** / ()  
**Vercel:** project **complianceloop-portal** (team: **compliance-loop**)

## Workflows (index)
- `.github/workflows/agent-smoke.yml` — Wait for Vercel Preview and run smoke test on each PR.
- `.github/workflows/design-skin-kit.yml` — Add theme tokens, global styles, /design-playground
- `.github/workflows/phase-1-auth-db.yml` — Neon + Drizzle schema; passwordless auth APIs
- `.github/workflows/phase-2-files-r2.yml` — Private file uploads to R2; secure streaming via /api/files/[...key]
- `.github/workflows/seed-phase-1.yml` — Optional seed of demo customer/jobs
- `.github/workflows/update-allowlist.yml` — Maintain preview allowlist/protection bypass as needed

## 13 Phases (overview)
1) Admin console
2) Airtable bridge (hybrid)
3) Assignment engine (first-accept, soft-hold cascade, single-eligible auto-assign)
4) Auth + DB base
5) Customer dashboard
6) Design Skin Kit
7) Files & Certificates (R2)
8) Job model + booking skeleton
9) Notifications (email/SMS)
10) Payments & invoices
11) Polish & launch (SEO, A11y, QA, rate limits)
12) Provider dashboard (+ day-of checklist, conflict)
13) Provider directory & eligibility

## Phase Details (objective & acceptance)
| Phase | Objective | Acceptance |
|---|---|---|
| Design Skin Kit | Theme tokens, brand, and UI primitives to speed all later pages. | Preview renders<br>Tokens adjustable with hot reload |
| Auth + DB base | Neon + Drizzle schema, passwordless email code, sessions. | Vercel env DATABASE_URL set<br>Auth code roundtrip works<br>Dashboard gate honors session |
| Files & Certificates (R2) | Private file storage with signed streaming. | Upload from provider portal → 200 r2Key<br>Authorized GET streams; unauthorized 403 |
| Airtable bridge (hybrid) | Mirror critical records for ops; Neon remains source of record. | One-way sync green in CI<br>Backfill job OK |
| Job model + booking skeleton | Booking wizard + soft hold creation. | 30m hold for multi-property<br>Single-property flow ok |
| Provider directory & eligibility | Eligibility rules + instant decision. | Pass/fail immediate<br>Declined path shows guidance |
| Assignment engine | First-accept wins + 15m soft-hold + single-eligible auto-assign. | Race handled; winner locks; cascade on timeout/decline |
| Customer dashboard | List past/upcoming jobs + files/invoices. | Auth required<br>Documents stream correctly |
| Provider dashboard | Job queue + day-of checklist + conflict report + tech email routing. | Late submission possible<br>Conflict auto-cascade |
| Payments & invoices | Invoice links and settlement (minimal MVP). | Invoices viewable; payments later (toggle) |
| Notifications (email/SMS) | Resend email events; SMS optional later. | Email on accept, conflict, ready-to-download |
| Admin console | Search jobs/providers; manual override tools. | Admin-only gate<br>Audit trail |
| Polish & launch | SEO, a11y, rate limits, QA. | Lighthouse ≥90<br>No PII leaks<br>Runbook updated |

## Journey Specs
### Customer
### Book Job
Customer submits property + contact; system places a soft hold and starts provider assignment.
- Customer opens /book (phase 3) → address autocomplete (MapLibre+Photon, free) or fallback manual.
- Validates property, date window, and intent (inspection/cert).
- Creates Job(draft) in Neon; optional mirror row in Airtable.
- If multiple properties: place a 30-minute hold across selected slots.
- Shows confirmation + 'magic link' to dashboard (passwordless).

**Success:** Job created, Soft hold established (30m for multi-property), Customer gets email link

### Dashboard (Passwordless)
Email magic code → session → list of past/upcoming jobs and documents.
- Customer enters email → receives 6-digit code (Resend).
- On success, session cookie issued; dashboard shows Jobs grouped by status.
- Each Job page: certificate (R2), photos (R2), invoice, activity history.

**Success:** Auth code verified, Jobs visible, Files stream from R2 with auth gate

### Reschedule/Cancel
Customer requests change; system re-runs assignment logic.
- Customer picks new window or cancel reason.
- If reschedule: releases old hold, re-runs provider offer cascade.
- If cancel inside lock window, fee policy applied (playbook docs).

**Success:** Job updated, Provider(s) notified, Policy respected

### Provider
### Onboarding & Eligibility
Instant check—no manual wait—against configured criteria.
- 

### Assignment & Acceptance
First-accept wins with 15-minute soft hold; single-eligible auto-assign.
- If 2+ eligible: broadcast offer; first Accept wins; hold 15m then confirm automatically.
- If exactly 1 eligible and free: auto-assign; provider may Report Conflict.
- Soft-hold cascade: if winner declines or times out → next eligible; or admin fallback list.

### Day-of Checklist & Files
Provider completes checklist; can upload later; can route comms to a technician email.
- Checklist submitted via portal; late submission allowed.
- Uploads stored in R2 under job prefix; streamed via signed route.
- Notification email target can be set per provider (technician routing).

## APIs (MVP)
- **POST** `/api/auth/send-code` — 200, code sent via Resend
- **POST** `/api/auth/verify-code` — 200, session cookie
- **POST** `/api/jobs` — 201, jobId + holds
- **POST** `/api/jobs/:id/accept` — 200, accepted or 409
- **POST** `/api/jobs/:id/conflict` — 202, cascade triggered
- **POST** `/api/files/upload` — 200, r2Key
- **GET** `/api/files/:key` — 200 stream if authorized

## Data Models
- **Job**: id, customerEmail, property, windowStart, windowEnd, status, providerId?, holdUntil?, kind, invoiceId?
- **Provider**: id, name, email, serviceArea, credentials, maxJobsPerDay, hours, icsUrl?, techEmail?
- **AssignmentEvent**: id, jobId, providerId, type, ts, meta
- **File**: id, jobId, ownerRole, r2Key, kind, ts

## Assignment Rules
- softHoldMinutes: 15
- customerMultiPropertyHoldMinutes: 30
- singleEligibleAutoAssign: true
- acceptWins: true

> Edit *decisions.json* to change these sections, then re-run this workflow.
<!-- CL:END -->
