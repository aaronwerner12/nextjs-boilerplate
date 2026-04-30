import { createHmac } from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

function hashPasscode(passcode: string): string {
  const secret = process.env.PASSCODE_SECRET || "etf-passcode-secret";
  return createHmac("sha256", secret).update(passcode).digest("hex");
}

const ORG_COLUMNS = sql`
  id, name, city, state, notify_email, logo_url,
  fiscal_year_start, threshold_min, threshold_strong, threshold_strategic
`;

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();

    if (!passcode) {
      return NextResponse.json({ error: "Passcode required" }, { status: 400 });
    }

    const hash = hashPasscode(passcode);

    // Try hashed lookup first (new orgs)
    let rows = await sql`
      SELECT id, name, city, state, notify_email, logo_url,
             fiscal_year_start, threshold_min, threshold_strong, threshold_strategic
      FROM etf_orgs
      WHERE passcode_hash = ${hash}
      LIMIT 1
    `;

    // Fall back to plaintext for orgs created before hashing was added, then migrate
    if (rows.length === 0) {
      const plainRows = await sql`
        SELECT id, name, city, state, notify_email, logo_url,
               fiscal_year_start, threshold_min, threshold_strong, threshold_strategic
        FROM etf_orgs
        WHERE passcode = ${passcode} AND (passcode_hash IS NULL OR passcode_hash = '')
        LIMIT 1
      `;
      if (plainRows.length > 0) {
        rows = plainRows;
        // Migrate to hashed storage
        await sql`
          UPDATE etf_orgs SET passcode_hash = ${hash}, passcode = NULL WHERE id = ${plainRows[0].id}
        `.catch(() => {});
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    const org = rows[0];

    const venues = await sql`
      SELECT name, address FROM etf_venues
      WHERE org_id = ${org.id}
      ORDER BY sort_order, name
    `;

    return NextResponse.json({
      id: org.id,
      name: org.name,
      city: org.city,
      state: org.state,
      notifyEmail: org.notify_email,
      logoUrl: org.logo_url || "",
      fiscalYearStart: org.fiscal_year_start ?? 10,
      thresholdMin: org.threshold_min ?? 75000,
      thresholdStrong: org.threshold_strong ?? 150000,
      thresholdStrategic: org.threshold_strategic ?? 300000,
      venues,
    });
  } catch (error) {
    console.error("POST /api/orgs/login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
