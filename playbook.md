# ComplianceLoop Portal – Playbook

Monorepo: `complianceloop-site`  
App: `apps/portal` (Next.js App Router on Vercel, Neon Postgres)

---

## House format (must follow)

1. **Full file replacements only.** Do not send patches/diffs.  
2. **Always include clickable GitHub editor links** for each file you want changed.  
3. **Provide verification steps** (browser URL and/or curl and the expected JSON).  
4. **Avoid path aliases for infra**—import critical libs (neon) directly in each route.  
5. **Idempotent SQL** for bootstrap: `CREATE TABLE/INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.

---

## Environment

- `DATABASE_URL` — Neon Postgres connection string set in Vercel Project → Settings → Environment Variables.

---

## Current endpoints

### 1) Bootstrap (idempotent)
- **File:** `apps/portal/app/api/providers/bootstrap/route.ts`  
- **GET:** `https://complianceloop-portal.vercel.app/api/providers/bootstrap`  
- **Creates/ensures:**  
  - `providers (id uuid pk, company_name, contact_email, contact_phone, status default 'pending')`  
  - `provider_services (provider_id uuid fk, service_code text, PK (provider_id, service_code))` + index on `service_code`  
  - `provider_zips (provider_id uuid fk, zip text check 5 digits, PK (provider_id, zip))` + indexes on `zip` and `provider_id`  
- **Response:** `{ "ok": true, "applied": <number> }`

### 2) Provider application
- **UI:** `https://complianceloop-portal.vercel.app/providers/apply`  
- **API:** `POST /api/providers/apply`  
- **Body:**
  ```json
  {
    "companyName": "Acme Fire",
    "contactEmail": "ops@acme.com",
    "contactPhone": "555-0100",
    "postalCodes": "06010 06011 06012",
    "services": ["EXIT_SIGN","E_LIGHT","EXTINGUISHERS"]
  }
