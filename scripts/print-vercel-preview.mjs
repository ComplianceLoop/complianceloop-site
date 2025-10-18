#!/usr/bin/env node
/*
 * Script: print-vercel-preview.mjs
 *
 * This helper script prints the most recent preview deployment URL
 * for the canonical Vercel project (complianceloop-site). It uses
 * the public Vercel API and requires a few environment variables
 * in order to authenticate:
 *
 *   VERCEL_TOKEN       – a personal access token with read access
 *   VERCEL_TEAM_ID     – the numeric ID of the Vercel team (optional if using VERCEL_TEAM_SLUG)
 *   VERCEL_TEAM_SLUG   – the slug of the Vercel team (e.g. 'compliance-loop')
 *   VERCEL_PROJECT_ID  – the ID of the canonical project. You can find
 *                        this in the Vercel UI under Settings → General.
 *
 * Running this script will fetch the latest deployment that targets
 * any preview environment (non‑production) and print its `url` field.
 * If no preview deployments are found, the script exits with a non‑zero
 * status code.
 */

import fetch from 'node-fetch';

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const teamSlug = process.env.VERCEL_TEAM_SLUG;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token || !projectId || (!teamId && !teamSlug)) {
  console.error('Missing environment variables: please set VERCEL_TOKEN, VERCEL_PROJECT_ID and either VERCEL_TEAM_ID or VERCEL_TEAM_SLUG');
  process.exit(1);
}

async function getLatestPreview() {
  const query = new URLSearchParams({
    projectId,
    limit: '10',
    teamId: teamId || undefined,
    teamSlug: teamSlug || undefined,
  });
  const url = `https://api.vercel.com/v6/deployments?${query.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    console.error(`Failed to fetch deployments: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    process.exit(1);
  }
  const data = await res.json();
  // Filter preview deployments (target === 'preview') and sort by created
  const previews = (data.deployments || []).filter((d) => d.target === 'preview');
  if (previews.length === 0) {
    console.error('No preview deployments found for this project');
    process.exit(1);
  }
  // The API returns deployments ordered by creation date, newest first
  const latest = previews[0];
  console.log(latest.url);
}

getLatestPreview().catch((err) => {
  console.error(err);
  process.exit(1);
});
