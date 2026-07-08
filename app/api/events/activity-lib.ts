import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Friendly labels for changed top-level fields; unlisted keys are
// either internal (skipped) or fall back to the raw key name.
const FIELD_LABELS: Record<string, string> = {
  name: "event name",
  firstDay: "event dates",
  lastDay: "event dates",
  venues: "venues",
  venue: "venues",
  siteSelectionOrg: "site selection org",
  status: "status",
  elig: "eligibility answers",
  calc: "impact model",
  docs: "documents checklist",
  notes: "notes",
  outcome: "outcome tracking",
  roomNights: "room nights",
  attendeeEst: "quick estimate",
  qualityPerAttendee: "quick estimate",
  outOfMarketPct: "visitor mix",
  hotelBlockConfirmed: "hotel block",
};
const SKIP_KEYS = new Set([
  "id", "orgId", "createdBy", "editedBy", "baseUpdatedAt", "updatedAt",
  "createdAt", "deletedAt", "created", "shareToken", "intakeId", "lastEditedBy",
]);

export function summarizeChanges(oldData: any, newData: any): string {
  const labels = new Set<string>();
  const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  keys.forEach((k) => {
    if (SKIP_KEYS.has(k)) return;
    if (JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k])) {
      labels.add(FIELD_LABELS[k] || k);
    }
  });
  return Array.from(labels).join(", ");
}

export async function ensureActivityTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_event_activity (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      org_id TEXT,
      member_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

export async function logActivity(eventId: string, orgId: string | null, member: string, summary: string) {
  if (!summary) return;
  await ensureActivityTable();
  // Coalesce: repeated saves of the same fields by the same person within
  // 15 minutes just bump the timestamp instead of piling up rows
  const recent = await sql`
    SELECT id FROM etf_event_activity
    WHERE event_id = ${eventId} AND member_name = ${member} AND summary = ${summary}
      AND created_at > NOW() - INTERVAL '15 minutes'
    LIMIT 1
  `;
  if (recent.length > 0) {
    await sql`UPDATE etf_event_activity SET created_at = NOW() WHERE id = ${recent[0].id}`;
  } else {
    const id = "act_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await sql`
      INSERT INTO etf_event_activity (id, event_id, org_id, member_name, summary)
      VALUES (${id}, ${eventId}, ${orgId}, ${member}, ${summary})
    `;
  }
}
