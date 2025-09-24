import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing. Add it in Vercel → Project → Settings → Environment Variables.");
}

const sql = neon(url);
export const db = drizzle(sql);
