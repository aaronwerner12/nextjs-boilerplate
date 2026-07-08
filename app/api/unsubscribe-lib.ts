import { createHmac } from "crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

function secret(): string {
  return process.env.PASSCODE_SECRET || "etf-passcode-secret";
}

// A per-email token so one recipient can't unsubscribe another
export function unsubToken(email: string): string {
  return createHmac("sha256", secret())
    .update("unsub:" + email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function unsubscribeUrl(email: string, appUrl: string): string {
  const e = encodeURIComponent(email.trim().toLowerCase());
  return `${appUrl}/api/unsubscribe?e=${e}&t=${unsubToken(email)}`;
}

export async function ensureOptOutTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_email_optout (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

// All addresses that have opted out, lowercased, as a Set for filtering
export async function getOptedOut(): Promise<Set<string>> {
  await ensureOptOutTable();
  const rows = await sql`SELECT email FROM etf_email_optout`.catch(() => []);
  return new Set(rows.map((r: any) => (r.email || "").trim().toLowerCase()));
}
