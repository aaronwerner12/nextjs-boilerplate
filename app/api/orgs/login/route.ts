import { createHmac } from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

const DEFAULT_SECRET = "etf-passcode-secret";

function hashWith(passcode: string, secret: string): string {
  return createHmac("sha256", secret).update(passcode).digest("hex");
}

function hashPasscode(passcode: string): string {
  return hashWith(passcode, process.env.PASSCODE_SECRET || DEFAULT_SECRET);
}

// Hashes under every secret this deployment may have used. Orgs whose
// passcode was hashed before PASSCODE_SECRET was configured (or after it
// was removed) still match, and get re-migrated to the current secret.
function candidateHashes(passcode: string): string[] {
  const current = process.env.PASSCODE_SECRET || DEFAULT_SECRET;
  const hashes = [hashWith(passcode, current)];
  if (current !== DEFAULT_SECRET) hashes.push(hashWith(passcode, DEFAULT_SECRET));
  return hashes;
}

const ORG_COLUMNS = sql`
  id, name, city, state, notify_email, logo_url,
  fiscal_year_start, threshold_min, threshold_strong, threshold_strategic
`;

// ── Rate limiting ─────────────────────────────────────────────────
// Failed attempts are recorded per-IP in Postgres so the limit holds
// across serverless instances and cold starts.
const MAX_FAILURES = 5;          // allowed failures per window
const WINDOW_MINUTES = 15;       // rolling window
const FAIL_DELAY_MS = 1000;      // slow every failed response to blunt scripts

async function ensureAttemptsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_login_attempts (
      ip TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : "").trim() || "unknown";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();

    if (!passcode) {
      return NextResponse.json({ error: "Passcode required" }, { status: 400 });
    }

    await ensureAttemptsTable();
    const ip = clientIp(req);

    // Reject before doing any passcode work if this IP is over the limit
    const recent = await sql`
      SELECT COUNT(*) as count FROM etf_login_attempts
      WHERE ip = ${ip} AND created_at > NOW() - INTERVAL '15 minutes'
    `;
    if (parseInt(recent[0]?.count || "0") >= MAX_FAILURES) {
      await sleep(FAIL_DELAY_MS);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${WINDOW_MINUTES} minutes.` },
        { status: 429 }
      );
    }

    const hash = hashPasscode(passcode);
    const candidates = candidateHashes(passcode);

    // Try hashed lookup first (new orgs). Matches hashes made under the
    // current secret OR the default secret from before PASSCODE_SECRET
    // was configured.
    let rows = await sql`
      SELECT id, name, city, state, notify_email, logo_url,
             fiscal_year_start, threshold_min, threshold_strong, threshold_strategic,
             passcode_hash
      FROM etf_orgs
      WHERE passcode_hash = ANY(${candidates})
      LIMIT 1
    `;

    // If matched under an old secret, re-hash under the current one
    if (rows.length > 0 && rows[0].passcode_hash !== hash) {
      await sql`
        UPDATE etf_orgs SET passcode_hash = ${hash} WHERE id = ${rows[0].id}
      `.catch(() => {});
    }

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
      // Record the failure, prune old rows, and slow the response
      await sql`INSERT INTO etf_login_attempts (ip) VALUES (${ip})`.catch(() => {});
      await sql`DELETE FROM etf_login_attempts WHERE created_at < NOW() - INTERVAL '1 day'`.catch(() => {});
      await sleep(FAIL_DELAY_MS);
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    // Successful login clears this IP's failure history
    await sql`DELETE FROM etf_login_attempts WHERE ip = ${ip}`.catch(() => {});

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
