
# ComplianceLoop — Static Site Starter

This is a minimal, brand‑aligned static website you can deploy in minutes.

## Pages
- `/index.html` — Home (hero, benefits, booking embed placeholder)
- `/services.html` — Phase‑1 services
- `/pricing.html` — Simple pricing overview + policies
- `/contact.html` — Booking widget + contact form placeholder

## Branding baked in
- Fonts: League Spartan (headings), Inter (body)
- Type scale (Major Third), base 16px, 150% line height, tightened heading tracking
- Colors: Navy #0A1045, Teal #00C2D1, Light Gray #D0D0D0, Muted Card #F5F7FA, White #FFFFFF, Light Navy #50547E

## Booking (Cal.com)
Search for `cal.com/complianceloop/compliance-appointment` in the HTML files and replace with your Cal.com booking link, e.g. `cal.com/yourname/compliance`.

## Make the contact form live
Replace the demo form with a Tally embed or an Airtable form and connect your automations.

## Quick deploy options
- **Netlify Drop:** go to `https://app.netlify.com/drop` and drag the whole folder (or the zip).
- **Vercel:** create a new project, select "Other" or "Static", and import this folder (or push to Git and import).

## Booking Wizard & Ingest

The `/book` page is a three‑step wizard that posts to a single `/api/ingest` endpoint.

### Environment setup

Set the following environment variables for Airtable ingestion:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_INTAKES_TABLE` (defaults to `Intakes`)
- `AIRTABLE_CONTACTS_TABLE` (for `/api/lookup`)

If Airtable variables are missing, submissions fall back to `MAKE_FORMS_WEBHOOK_URL`.

### Adding properties

Step 1 lets visitors add multiple property address/city pairs. Use the “Add another property” button.

### Cal scheduling

Step 2 embeds Cal.com inline. If it fails, the “Open scheduler in new tab” link is provided with name/email prefilled.

### Smoke tests

- `/book` new visitor → submit → Intakes row created.
- `/book?returning=1` with known email → fields prefilled via `/api/lookup`.
- `/book?multi=1` → add two properties and submit.
- `/providers` form → Intakes row of type `provider`.

Check network responses for `200` from `/api/ingest` and `/api/lookup`.
