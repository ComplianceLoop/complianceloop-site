#!/usr/bin/env node
/*
 * Script: check-env.mjs
 *
 * This script enumerates a set of required environment variable names
 * and fails if any are missing at runtime. It is intended to be
 * executed during CI to ensure the canonical Vercel project has all
 * necessary configuration. The list below captures the variables
 * referenced throughout the complianceloop-site monorepo. Adjust
 * as needed when new dependencies arise.
 */

const required = [
  // Database and storage
  'DATABASE_URL',
  'R2_REGION',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ACCOUNT_ID',
  // Airtable
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
  'AIRTABLE_TABLE',
  'AIRTABLE_INTAKES_TABLE',
  'AIRTABLE_CONTACTS_TABLE',
  // Authentication and sessions
  'AUTH_SESSION_TTL_MINUTES',
  // Webhooks and integrations
  'MAKE_WEBHOOK_PLANNER',
  'MAKE_WEBHOOK_MAGIC',
  'MAKE_WEBHOOK_PROVIDER',
  'MAKE_WEBHOOK_BOOK',
  'MAKE_FORMS_WEBHOOK_URL',
  // Other project settings
  'ORIGIN_ALLOWLIST',
  'CAL_LINK',
  'USE_DIRECT_WEBHOOKS',
  // Automation and preview bypass
  'VERCEL_BYPASS_TOKEN',
  // R2 public base (used in tests and scripts)
  'R2_PUBLIC_BASE',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach((name) => console.error(` - ${name}`));
  process.exit(1);
} else {
  console.log('All required environment variables are present.');
}
