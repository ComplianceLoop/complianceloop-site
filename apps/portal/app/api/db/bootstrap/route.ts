// apps/portal/app/api/db/bootstrap/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs/promises';
import path from 'node:path';

const { DATABASE_URL } = process.env;

// Split SQL file into individual statements (very simple splitter; assumes no semicolons inside dollar-quoted bodies)
function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ';');
}

export async function GET() {
  if (!DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set' },
      { status: 500 }
    );
  }

  try {
    const sqlPath = path.resolve(process.cwd(), 'apps/portal/db/bootstrap.sql');
    const ddl = await fs.readFile(sqlPath, 'utf8');
    const statements = splitSql(ddl);

    const client = neon(DATABASE_URL);

    // Run inside a transaction with SERIALIZABLE isolation
    await client`BEGIN`;
    await client`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

    for (const stmt of statements) {
      // Use raw execution for each statement
      // @ts-ignore - neon tagged template expects arrays; using text method via "any"
      await (client as any).sql?.(stmt) ?? await client(stmt as any);
    }

    await client`COMMIT`;

    return NextResponse.json({ ok: true, statements: statements.length });
  } catch (err: any) {
    try {
      const client = neon(DATABASE_URL!);
      await client`ROLLBACK`;
    } catch {
      // ignore rollback errors
    }
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
