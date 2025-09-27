# ComplianceLoop Playbook

<!-- CL:START -->
# ComplianceLoop — Canonical Plan (Generated)

**Repo:** / ()  
**Vercel:** project **complianceloop-portal** (team: ****)

## Workflows (index)


## 13 Phases (overview)
1) {
2)   "phase": "Design Skin Kit",
3)   "objective": "Theme tokens, brand, and UI primitives to speed all later pages.",
4)   "deliverables": [
5)     "theme.ts tokens",
6)     "globals.css",
7)     "Button/Input/Card",
8)     "/design-playground"
9)   ],
10)   "acceptance": [
11)     "Preview renders",
12)     "Tokens adjustable with hot reload"
13)   ]
14) }
15) {
16)   "phase": "Auth + DB base",
17)   "objective": "Neon + Drizzle schema, passwordless email code, sessions.",
18)   "deliverables": [
19)     "/api/auth/send-code",
20)     "/api/auth/verify-code",
21)     "users, sessions tables"
22)   ],
23)   "acceptance": [
24)     "Vercel env DATABASE_URL set",
25)     "Auth code roundtrip works",
26)     "Dashboard gate honors session"
27)   ],
28)   "status": "landed",
29)   "landedAt": "2025-09-26",
30)   "verification": [
31)     "DATABASE_URL set",
32)     "send-code 200",
33)     "verify-code 200 (session issued)"
34)   ]
35) }
36) {
37)   "phase": "Files & Certificates (R2)",
38)   "objective": "Private file storage with signed streaming.",
39)   "deliverables": [
40)     "/api/files/upload",
41)     "/api/files/:key",
42)     "R2 bucket + IAM"
43)   ],
44)   "acceptance": [
45)     "Upload from provider portal → 200 r2Key",
46)     "Authorized GET streams; unauthorized 403"
47)   ]
48) }
49) {
50)   "phase": "Airtable bridge (hybrid)",
51)   "objective": "Mirror critical records for ops; Neon remains source of record.",
52)   "deliverables": [
53)     "sync script, cron",
54)     "idempotent mapping"
55)   ],
56)   "acceptance": [
57)     "One-way sync green in CI",
58)     "Backfill job OK"
59)   ]
60) }
61) {
62)   "phase": "Job model + booking skeleton",
63)   "objective": "Booking wizard + soft hold creation.",
64)   "deliverables": [
65)     "/book wizard",
66)     "create Job(draft) API",
67)     "Soft-hold service"
68)   ],
69)   "acceptance": [
70)     "30m hold for multi-property",
71)     "Single-property flow ok"
72)   ]
73) }
74) {
75)   "phase": "Provider directory & eligibility",
76)   "objective": "Eligibility rules + instant decision.",
77)   "deliverables": [
78)     "criteria engine",
79)     "provider onboarding form",
80)     "How-to-qualify guidance"
81)   ],
82)   "acceptance": [
83)     "Pass/fail immediate",
84)     "Declined path shows guidance"
85)   ]
86) }
87) {
88)   "phase": "Assignment engine",
89)   "objective": "First-accept wins + 15m soft-hold + single-eligible auto-assign.",
90)   "deliverables": [
91)     "offer broadcast",
92)     "accept endpoint",
93)     "cascade logic"
94)   ],
95)   "acceptance": [
96)     "Race handled; winner locks; cascade on timeout/decline"
97)   ]
98) }
99) {
100)   "phase": "Customer dashboard",
101)   "objective": "List past/upcoming jobs + files/invoices.",
102)   "deliverables": [
103)     "dashboard pages",
104)     "job detail route"
105)   ],
106)   "acceptance": [
107)     "Auth required",
108)     "Documents stream correctly"
109)   ]
110) }
111) {
112)   "phase": "Provider dashboard",
113)   "objective": "Job queue + day-of checklist + conflict report + tech email routing.",
114)   "deliverables": [
115)     "checklist form",
116)     "conflict endpoint",
117)     "email routing field"
118)   ],
119)   "acceptance": [
120)     "Late submission possible",
121)     "Conflict auto-cascade"
122)   ]
123) }
124) {
125)   "phase": "Payments & invoices",
126)   "objective": "Invoice links and settlement (minimal MVP).",
127)   "deliverables": [
128)     "invoice record",
129)     "link on job page"
130)   ],
131)   "acceptance": [
132)     "Invoices viewable; payments later (toggle)"
133)   ]
134) }
135) {
136)   "phase": "Notifications (email/SMS)",
137)   "objective": "Resend email events; SMS optional later.",
138)   "deliverables": [
139)     "templates",
140)     "event triggers"
141)   ],
142)   "acceptance": [
143)     "Email on accept, conflict, ready-to-download"
144)   ]
145) }
146) {
147)   "phase": "Admin console",
148)   "objective": "Search jobs/providers; manual override tools.",
149)   "deliverables": [
150)     "admin routes",
151)     "impersonate (guarded)"
152)   ],
153)   "acceptance": [
154)     "Admin-only gate",
155)     "Audit trail"
156)   ]
157) }
158) {
159)   "phase": "Polish & launch",
160)   "objective": "SEO, a11y, rate limits, QA.",
161)   "deliverables": [
162)     "schema.org Business markup",
163)     "robots, sitemaps",
164)     "basic rate limiting"
165)   ],
166)   "acceptance": [
167)     "Lighthouse ≥90",
168)     "No PII leaks",
169)     "Runbook updated"
170)   ]
171) }

## Phase Details (objective, status & acceptance)
| Phase | Objective | Status | Acceptance |
|---|---|---|---|


## Journey Specs
### Customer


### Provider


## APIs (MVP)


## Data Models


## Assignment Rules
- softHoldMinutes: 15
- customerMultiPropertyHoldMinutes: 30
- singleEligibleAutoAssign: true
- acceptWins: true

> Edit *decisions.json* to change these sections, then re-run this workflow.
<!-- CL:END -->
