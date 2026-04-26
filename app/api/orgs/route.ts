import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'TX',
      notify_email TEXT,
      passcode TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS notify_email TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS passcode TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS logo_url TEXT`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS etf_venues (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES etf_orgs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Add org_id to events table if it doesn't exist yet
  await sql`
    ALTER TABLE etf_events
    ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES etf_orgs(id)
  `.catch(() => {}); // ignore if etf_events doesn't exist yet — events route will create it
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const orgs = await sql`SELECT * FROM etf_orgs WHERE id = ${id}`;
      if (orgs.length === 0) {
        return NextResponse.json({ error: "Org not found" }, { status: 404 });
      }
      const venues = await sql`
        SELECT * FROM etf_venues WHERE org_id = ${id} ORDER BY sort_order, name
      `;
      return NextResponse.json({ ...orgs[0], notifyEmail: orgs[0].notify_email, logoUrl: orgs[0].logo_url, venues });
    }

    const orgs = await sql`SELECT id, name, city, state, notify_email, created_at FROM etf_orgs ORDER BY name`;
    return NextResponse.json(orgs);
  } catch (error) {
    console.error("GET /api/orgs error:", error);
    return NextResponse.json({ error: "Failed to fetch org" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { id, name, city = "", state = "TX", notifyEmail = "", passcode = "", logoUrl = "", venues = [] } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sql`
      INSERT INTO etf_orgs (id, name, city, state, notify_email, passcode, logo_url)
      VALUES (${id}, ${name}, ${city}, ${state}, ${notifyEmail}, ${passcode}, ${logoUrl})
      ON CONFLICT (id) DO UPDATE
        SET name = ${name}, city = ${city}, state = ${state},
            notify_email = ${notifyEmail},
            passcode = COALESCE(NULLIF(${passcode}, ''), etf_orgs.passcode),
            logo_url = ${logoUrl}
    `;

    // Replace venues for this org
    await sql`DELETE FROM etf_venues WHERE org_id = ${id}`;
    for (let i = 0; i < venues.length; i++) {
      const v = venues[i];
      const venueId = `${id}_v${i}`;
      await sql`
        INSERT INTO etf_venues (id, org_id, name, address, sort_order)
        VALUES (${venueId}, ${id}, ${v.name}, ${v.address || ""}, ${i})
      `;
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("POST /api/orgs error:", error);
    return NextResponse.json({ error: "Failed to save org" }, { status: 500 });
  }
}
