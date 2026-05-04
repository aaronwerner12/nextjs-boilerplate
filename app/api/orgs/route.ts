import { createHmac } from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

function hashPasscode(passcode: string): string {
  const secret = process.env.PASSCODE_SECRET || "etf-passcode-secret";
  return createHmac("sha256", secret).update(passcode).digest("hex");
}

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
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS passcode_hash TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS logo_url TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS fiscal_year_start INT DEFAULT 10`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS threshold_min INT DEFAULT 75000`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS threshold_strong INT DEFAULT 150000`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS threshold_strategic INT DEFAULT 300000`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS address TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS contact_name TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS contact_title TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS contact_phone TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS contact_email TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS tax_id TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS signatory_name TEXT`.catch(() => {});
  await sql`ALTER TABLE etf_orgs ADD COLUMN IF NOT EXISTS signatory_title TEXT`.catch(() => {});
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
  await sql`
    ALTER TABLE etf_events
    ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES etf_orgs(id)
  `.catch(() => {});
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const orgs = await sql`
        SELECT id, name, city, state, notify_email, logo_url,
               fiscal_year_start, threshold_min, threshold_strong, threshold_strategic,
               address, contact_name, contact_title, contact_phone, contact_email,
               tax_id, signatory_name, signatory_title
        FROM etf_orgs WHERE id = ${id}
      `;
      if (orgs.length === 0) {
        return NextResponse.json({ error: "Org not found" }, { status: 404 });
      }
      const venues = await sql`
        SELECT * FROM etf_venues WHERE org_id = ${id} ORDER BY sort_order, name
      `;
      const org = orgs[0];
      return NextResponse.json({
        ...org,
        notifyEmail: org.notify_email,
        logoUrl: org.logo_url,
        fiscalYearStart: org.fiscal_year_start ?? 10,
        thresholdMin: org.threshold_min ?? 75000,
        thresholdStrong: org.threshold_strong ?? 150000,
        thresholdStrategic: org.threshold_strategic ?? 300000,
        contactName: org.contact_name,
        contactTitle: org.contact_title,
        contactPhone: org.contact_phone,
        contactEmail: org.contact_email,
        taxId: org.tax_id,
        signatoryName: org.signatory_name,
        signatoryTitle: org.signatory_title,
        venues,
      });
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
    const {
      id, name, city = "", state = "TX", notifyEmail = "", passcode = "",
      logoUrl = "", fiscalYearStart = 10,
      thresholdMin = 75000, thresholdStrong = 150000, thresholdStrategic = 300000,
      venues = [],
      address = "", contactName = "", contactTitle = "", contactPhone = "",
      contactEmail = "", taxId = "", signatoryName = "", signatoryTitle = "",
    } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const passcodeHash = passcode ? hashPasscode(passcode) : null;

    await sql`
      INSERT INTO etf_orgs (id, name, city, state, notify_email, passcode_hash, logo_url, fiscal_year_start, threshold_min, threshold_strong, threshold_strategic,
        address, contact_name, contact_title, contact_phone, contact_email, tax_id, signatory_name, signatory_title)
      VALUES (${id}, ${name}, ${city}, ${state}, ${notifyEmail}, ${passcodeHash}, ${logoUrl}, ${fiscalYearStart}, ${thresholdMin}, ${thresholdStrong}, ${thresholdStrategic},
        ${address}, ${contactName}, ${contactTitle}, ${contactPhone}, ${contactEmail}, ${taxId}, ${signatoryName}, ${signatoryTitle})
      ON CONFLICT (id) DO UPDATE
        SET name = ${name}, city = ${city}, state = ${state},
            notify_email = ${notifyEmail},
            passcode_hash = CASE WHEN ${passcodeHash}::TEXT IS NOT NULL THEN ${passcodeHash} ELSE etf_orgs.passcode_hash END,
            logo_url = ${logoUrl},
            fiscal_year_start = ${fiscalYearStart},
            threshold_min = ${thresholdMin},
            threshold_strong = ${thresholdStrong},
            threshold_strategic = ${thresholdStrategic},
            address = ${address},
            contact_name = ${contactName},
            contact_title = ${contactTitle},
            contact_phone = ${contactPhone},
            contact_email = ${contactEmail},
            tax_id = ${taxId},
            signatory_name = ${signatoryName},
            signatory_title = ${signatoryTitle}
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
