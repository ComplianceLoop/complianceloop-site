# ComplianceLoop Playbook


_Last updated: 2025-09-22 (corrected)_


## Canonical Targets
- **Repo:** `ComplianceLoop/complianceloop-site` (branch: `main`)
https://github.com/ComplianceLoop/complianceloop-site
- **Vercel Project:** `complianceloop-site` under team `compliance-loop`
- **Primary Domain:** complianceloop.com


## Brand Architecture
- **Umbrella (legal/master):** LoopWorks
- **Line brand (current GTM):** **ComplianceLoop** — inspection/testing + filings.
- **Future lines (optional):** ServiceLoop (general property services), ProjectLoop (one‑off projects), SafetyLoop (life‑safety).
- **Pitch:** _One coordinator, one schedule, one invoice, zero missed deadlines._


## Market & Scope
- **Phase‑1 offerings (start lean):**
1. Fire extinguisher annual inspection and tagging (NFPA 10).
2. Emergency lighting and exit sign annual testing with written records.
3. Backflow prevention device testing (where properties are on public water; offer but do not lead in well‑heavy areas like Monroe).
4. Optional “by request”: boiler/pressure‑vessel inspection coordination, grease trap pumping (restaurant vertical later).
- **Customers (initial):** HOAs, condo associations, property management firms; **next:** small commercial properties.
- **Geography (initial focus):** Fairfield County — Monroe, Trumbull, Shelton, Newtown, Danbury, Fairfield, Milford.
- **Pricing pattern:** Service‑level price, **subject to $15 minimum**.
- **Insurance before first contract:** $1M general liability **and** $1M errors & omissions.


## Legal & Tax (summary, no secrets)
- **Legal entity:** Standard Works LLC, doing business as **ComplianceLoop**.
- **Tax structure:** LLC taxed as S‑Corp once net profits pass ~\$60k.
- **EIN:** `SECRET:EIN` (stored in private vault; do not commit).
- **Name control (IRS e‑file):** `LOOP`.
- **Responsible party:** Raymond J. Sbrega II, Sole Member.
- **Address on file:** 54 Grist Mill Road, Monroe, CT 06468.


## Minimal Data Models (for scheduling)
**Vendor**
- `id`, `name`, `email`, `phone`, `service_area` (ZIPs or radius), `time_zone`
- `calendar_provider` (`google|microsoft|icloud`), `connected_account_id`, `status`
- `busy_calendar_ids[]`, `write_calendar_id`
- `rules`: `service_duration_minutes`, `travel_buffer_minutes`, `minimum_notice_hours`,
`working_hours` (per weekday), `daily_capacity`, `blackout_dates`


**Booking**
- `id`, `customer_id`, `vendor_id`, `service_id`
- `start_at`, `end_at`, `time_zone`
- `status`: `candidate ⇒ held ⇒ confirmed ⇒ completed/canceled`
- `hold_expires_at`
- `external_event`: `provider`, `event_id`
- `payment`: `intent_id`, `status`, `amount_customer`, `amount_vendor`, `amount_platform`


### Permissions (minimal)
- Read **free/busy** and **write** events to a single `ComplianceLoop` calendar per vendor.
- **Do not** read event bodies; store **only** event IDs and timing.


### Slot Generation ("live" availability)
1. Build candidate start times from vendor working hours, duration, and buffers.
2. Query free/busy for each vendor over the displayed window (e.g., next 14 days).
3. Remove conflicts; respect daily capacity and blackout days.
4. Rank remaining slots by proximity, vendor utilization balance, and fairness (round‑robin).
5. Show the top **N** slots to the customer.


### Double‑Booking Safety
- On slot click: create a **hold** event on vendor write calendar and a booking with `status=held`; set `hold_expires_at` (e.g., 15 minutes).
- If checkout succeeds: update the event to **confirmed**, set `status=confirmed`.
- If checkout fails or expires: delete the event, set `status=canceled (reason=expired)`.


### Checkout & Payouts (happy path)
1. Customer pays on site (charge immediately).
2. After service window finishes (or vendor marks **done**), set `status=completed`.
3. Trigger **Stripe transfer** to vendor connected account for wholesale amount; platform keeps its share automatically.
4. Send receipts to customer and vendor.


### Notifications (email + SMS)
- **Vendor:** new hold, confirmed booking, changes, day‑before reminder, day‑of first stop time.
- **Customer:** confirmation, reminder, technician "on the way", completion receipt, reschedule links.


### Metrics to Track from Day One
- Slot view → hold conversion
- Hold → paid conversion
- Cancellations by reason
- On‑time arrival rate
- Vendor calendar disconnect rate
- Dispute rate
- Average payout time


- Backflow testing emphasized only where public water; de‑emphasize in well‑heavy areas (e.g., Monroe).
