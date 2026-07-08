import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_events (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      data JSONB NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'Unknown',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Add org_id column if upgrading from old schema
  await sql`ALTER TABLE etf_events ADD COLUMN IF NOT EXISTS org_id TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`.catch(() => {});
}

// GET /api/events?org_id=xxx
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    const wantDeleted = searchParams.get("deleted") === "1";

    // Purge anything trashed more than 30 days ago
    await sql`DELETE FROM etf_events WHERE deleted_at < NOW() - INTERVAL '30 days'`.catch(() => {});

    let rows;
    if (orgId && wantDeleted) {
      rows = await sql`
        SELECT id, org_id, data, created_by, created_at, updated_at, deleted_at
        FROM etf_events
        WHERE org_id = ${orgId} AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
    } else if (orgId) {
      rows = await sql`
        SELECT id, org_id, data, created_by, created_at, updated_at, deleted_at
        FROM etf_events
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
    } else {
      // Fallback — return all (for backwards compat)
      rows = await sql`
        SELECT id, org_id, data, created_by, created_at, updated_at, deleted_at
        FROM etf_events
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
    }

    const events = rows.map((row) => ({
      ...row.data,
      id: row.id,
      orgId: row.org_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || null,
    }));
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST /api/events
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, createdBy = "Unknown", orgId, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    await sql`
      INSERT INTO etf_events (id, org_id, data, created_by, updated_at)
      VALUES (${id}, ${orgId || null}, ${JSON.stringify(data)}, ${createdBy}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data       = ${JSON.stringify(data)},
            org_id     = ${orgId || null},
            created_by = ${createdBy},
            updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to save event" }, { status: 500 });
  }
}
