import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function ensureRunLogTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_cron_runs (
      id TEXT PRIMARY KEY,
      job TEXT NOT NULL,
      recipients INT DEFAULT 0,
      sent INT DEFAULT 0,
      detail TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
}

// Record the outcome of a cron run so the admin portal can show health.
export async function logCronRun(job: string, recipients: number, sent: number, detail = "") {
  await ensureRunLogTable();
  const id = "run_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await sql`
    INSERT INTO etf_cron_runs (id, job, recipients, sent, detail)
    VALUES (${id}, ${job}, ${recipients}, ${sent}, ${detail})
  `.catch(() => {});
  // Keep the log tidy
  await sql`DELETE FROM etf_cron_runs WHERE created_at < NOW() - INTERVAL '180 days'`.catch(() => {});
}
